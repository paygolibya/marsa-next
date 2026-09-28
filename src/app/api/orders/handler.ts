import { NextResponse } from "next/server";
import { buildLightboxConfig, getLightboxScriptUrl, isMoamalatConfigured, makeOrderReference } from "@/lib/payment/moamalat-client";
import { createOrderSchema } from "@/lib/validation";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";
import { resolveCouponDiscount } from "@/lib/coupons";
import type { ShipmentOrder, ShipmentResult } from "@/lib/integrations/couriers";

class OutOfStockError extends Error {
  constructor(productName: string) {
    super(`لا يوجد مخزون كافٍ من: ${productName}`);
  }
}
class ProductNotFoundError extends Error {}
class InvalidCouponError extends Error {}

type Product = { id: string; name: string; priceCents: number; stockQty: number; trackInventory: boolean };
type Variant = { id: string; stockQty: number; priceCents: number | null; options: Record<string, string> };
type Coupon = {
  id: string;
  code: string;
  active: boolean;
  discountType: string;
  discountValue: number;
  minOrderCents: number | null;
  maxUsage: number | null;
  usageCount: number;
  expiresAt: Date | null;
};
type OrderRow = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  totalCents: number;
  discountCents: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- args
// deliberately loose (not Prisma's exact generated shapes) so the real
// PrismaClient structurally satisfies this interface — see the same
// pattern (and reasoning) in customize/handler.ts.
type Any = any;

export type OrdersTx = {
  product: { findFirst: (args: Any) => Promise<Product | null>; update: (args: Any) => Promise<unknown> };
  productVariant: { findFirst: (args: Any) => Promise<Variant | null>; update: (args: Any) => Promise<unknown> };
  coupon: { findUnique: (args: Any) => Promise<Coupon | null>; update: (args: Any) => Promise<unknown> };
  order: { create: (args: Any) => Promise<OrderRow> };
};

export type OrdersDb = {
  // These two keep concrete (not `Any`) args types, unlike the rest of
  // this interface — Prisma's findUnique/findFirst are generic over their
  // args, and with `include` present the *return type* is conditionally
  // specialized to actually contain the related model (merchant/city
  // below). Typing the args as `Any` degrades that generic to its base
  // case, which silently drops `merchant`/`city` from the real client's
  // inferred return type and breaks the structural match against this
  // interface.
  store: {
    findUnique: (args: { where: { slug: string }; include: { merchant: true } }) => Promise<{
      id: string;
      slug: string;
      courier: string;
      codEnabled: boolean;
      walletProvider: string | null;
      merchant: { phone: string } & Record<string, unknown>;
    } | null>;
  };
  vanexArea: {
    findUnique: (args: { where: { id: string }; include: { city: true } }) => Promise<{
      id: string;
      name: string;
      priceCents: number;
      vanexId: number;
      city: { name: string; vanexId: number };
    } | null>;
  };
  order: { update: (args: Any) => Promise<unknown> };
  // Untyped: Prisma's real $transaction is overloaded (array-of-promises
  // form vs. callback form), and TS tries to match a single declared
  // signature against both simultaneously. The callback passed at the
  // call site below is still fully typed via its own (tx: OrdersTx)
  // annotation, so this only loses type-checking on the outer call, not
  // on the transaction body itself.
  $transaction: Any;
};

export type OrdersDeps = {
  db: OrdersDb;
  createShipment: (courier: string, order: ShipmentOrder) => Promise<ShipmentResult>;
  sendOrderConfirmationEmail: (order: {
    id: string;
    buyerName: string;
    buyerEmail: string | null;
    totalCents: number;
    courierTrackingId?: string | null;
    storeSlug?: string;
  }) => Promise<void>;
  sendNewOrderSms: (phone: string, orderId: string, buyerName: string) => Promise<unknown>;
};

// POST /api/orders — a buyer places an order from the storefront's
// checkout page. No auth required. See route.ts for why this is
// injectable: it's the single most important route in the app (the one
// that actually moves money and inventory), and this lets it be
// integration-tested — server-side price/discount/shipping recomputation,
// the stock-decrement transaction, the wallet-vs-COD branch — without a
// real database or real Vanex/SendGrid calls.
export async function handleCreateOrder(deps: OrdersDeps, req: Request): Promise<Response> {
  const { db } = deps;
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeSlug, items, buyer, paymentMethod, couponCode } = parsed.data;

    const store = await db.store.findUnique({ where: { slug: storeSlug }, include: { merchant: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    if (paymentMethod === "wallet") {
      const walletAvailable = getCheckoutPaymentMethods(getSubscriptionState(store.merchant as Any)).dpay;
      if (!store.walletProvider || !walletAvailable || !isMoamalatConfigured()) {
        return NextResponse.json({ error: "This store has no wallet payment option enabled" }, { status: 400 });
      }
    }
    if (paymentMethod === "cod" && !store.codEnabled) {
      return NextResponse.json({ error: "This store does not accept cash on delivery" }, { status: 400 });
    }

    let shippingCents = 0;
    let buyerCity = buyer.city;
    let vanexShipping: { cityId: number; subCityId: number } | undefined;
    if (buyer.vanexAreaId) {
      const area = await db.vanexArea.findUnique({ where: { id: buyer.vanexAreaId }, include: { city: true } });
      if (!area) return NextResponse.json({ error: "المنطقة المختارة غير صالحة" }, { status: 400 });
      shippingCents = area.priceCents;
      buyerCity = `${area.city.name} - ${area.name}`;
      vanexShipping = { cityId: area.city.vanexId, subCityId: area.vanexId };
    }

    let order: OrderRow;
    try {
      order = await db.$transaction(
        async (tx: OrdersTx): Promise<OrderRow> => {
          const resolvedItems: { product: Product; quantity: number; variant: Variant | null; unitPriceCents: number; variantLabel: string | null }[] = [];
          for (const { productId, quantity, variantId } of items) {
            const product = await tx.product.findFirst({ where: { id: productId, storeId: store.id, active: true } });
            if (!product) throw new ProductNotFoundError(`Product ${productId} not found in this store`);

            let variant: Variant | null = null;
            if (variantId) {
              variant = await tx.productVariant.findFirst({ where: { id: variantId, productId: product.id, active: true } });
              if (!variant) throw new ProductNotFoundError(`Variant ${variantId} not found for product ${productId}`);
              if (variant.stockQty < quantity) throw new OutOfStockError(product.name);
            } else if (product.trackInventory && product.stockQty < quantity) {
              throw new OutOfStockError(product.name);
            }

            resolvedItems.push({
              product,
              quantity,
              variant,
              unitPriceCents: variant?.priceCents ?? product.priceCents,
              variantLabel: variant ? Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join("، ") : null,
            });
          }

          const productSubtotalCents = resolvedItems.reduce((sum, { unitPriceCents, quantity }) => sum + unitPriceCents * quantity, 0);

          let discountCents = 0;
          let appliedCouponCode: string | null = null;
          if (couponCode) {
            const normalizedCode = couponCode.trim().toUpperCase();
            const coupon = await tx.coupon.findUnique({ where: { storeId_code: { storeId: store.id, code: normalizedCode } } });
            if (!coupon) throw new InvalidCouponError("رمز الكوبون غير صحيح");
            const result = resolveCouponDiscount(coupon, productSubtotalCents);
            if (!result.valid) throw new InvalidCouponError(result.message || "الكوبون غير صالح");
            discountCents = result.discountCents;
            appliedCouponCode = coupon.code;
            await tx.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
          }

          const totalCents = productSubtotalCents - discountCents + shippingCents;

          const created = await tx.order.create({
            data: {
              storeId: store.id,
              buyerName: buyer.name,
              buyerPhone: buyer.phone,
              buyerEmail: buyer.email || null,
              buyerCity,
              buyerAddress: buyer.address,
              paymentMethod,
              paymentStatus: "pending",
              status: "pending",
              productSubtotalCents,
              discountCents,
              couponCode: appliedCouponCode,
              totalCents,
              shippingCents,
              vanexAreaId: buyer.vanexAreaId || null,
              items: {
                create: resolvedItems.map(({ product, quantity, variant, unitPriceCents, variantLabel }) => ({
                  productId: product.id,
                  productName: product.name,
                  unitPriceCents,
                  quantity,
                  variantId: variant?.id ?? null,
                  variantLabel,
                })),
              },
            },
          });

          for (const { product, quantity, variant } of resolvedItems) {
            if (variant) {
              const remaining = variant.stockQty - quantity;
              await tx.productVariant.update({ where: { id: variant.id }, data: { stockQty: remaining, ...(remaining <= 0 ? { active: false } : {}) } });
              continue;
            }
            if (!product.trackInventory) continue;
            const remaining = product.stockQty - quantity;
            await tx.product.update({ where: { id: product.id }, data: { stockQty: remaining, ...(remaining <= 0 ? { active: false } : {}) } });
          }

          return created;
        },
        { timeout: 15000, maxWait: 10000 }
      );
    } catch (err) {
      if (err instanceof OutOfStockError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof InvalidCouponError) return NextResponse.json({ error: err.message }, { status: 400 });
      throw err;
    }

    const totalCents = order.totalCents;
    const discountCents = order.discountCents;

    if (paymentMethod === "wallet") {
      const lightbox = buildLightboxConfig(totalCents, makeOrderReference(order.id));
      return NextResponse.json(
        { orderId: order.id, totalCents, shippingCents, discountCents, paymentStatus: "pending", moamalat: lightbox, moamalatScriptUrl: getLightboxScriptUrl() },
        { status: 201 }
      );
    }

    const shipment = await deps.createShipment(store.courier, {
      id: order.id,
      buyer: { ...buyer, city: buyerCity },
      totalCents,
      paymentMethod,
      itemsCount: items.reduce((sum, { quantity }) => sum + quantity, 0),
      vanex: vanexShipping,
    });
    await db.order.update({ where: { id: order.id }, data: { status: "confirmed", courierTrackingId: shipment.trackingId } });

    await deps.sendOrderConfirmationEmail({
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      totalCents,
      courierTrackingId: shipment.trackingId,
      storeSlug: store.slug,
    });
    await deps.sendNewOrderSms(store.merchant.phone, order.id, order.buyerName);

    return NextResponse.json(
      { orderId: order.id, totalCents, shippingCents, discountCents, trackingId: shipment.trackingId, courier: store.courier, paymentStatus: "pending" },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
