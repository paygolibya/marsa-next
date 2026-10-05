import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { buildLightboxConfig, getLightboxScriptUrl, isMoamalatConfigured, makeOrderReference } from "@/lib/payment/moamalat-client";
import { createOrderSchema } from "@/lib/validation";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";
import { resolveCouponDiscount } from "@/lib/coupons";
import { isSlotOpen, type WorkingHours } from "@/lib/booking";
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
type BundleComponent = { productId: string; quantity: number; product: { name: string; stockQty: number; trackInventory: boolean } };
type Bundle = { id: string; name: string; priceCents: number; items: BundleComponent[] };

// What becomes one OrderItem row. A bundle line is recorded as a single
// row (productId null, bundleId set) rather than exploded into one row
// per component — splitting a bundle's fixed price across its parts would
// risk rounding drift from the amount actually charged. Stock for the
// components is tracked separately via StockDecrement below.
type ResolvedItem = {
  productId: string | null;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  variantId: string | null;
  variantLabel: string | null;
  bundleId: string | null;
  bundleName: string | null;
  bundleItemsSnapshot: { productName: string; quantity: number }[] | null;
};
type StockDecrement =
  | { kind: "product"; productId: string; quantity: number; trackInventory: boolean; name: string }
  | { kind: "variant"; variantId: string; quantity: number; name: string };
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

type CountResult = { count: number };

export type OrdersTx = {
  product: { findFirst: (args: Any) => Promise<Product | null>; updateMany: (args: Any) => Promise<CountResult> };
  productVariant: { findFirst: (args: Any) => Promise<Variant | null>; updateMany: (args: Any) => Promise<CountResult> };
  bundle: { findFirst: (args: Any) => Promise<Bundle | null> };
  coupon: { findUnique: (args: Any) => Promise<Coupon | null>; updateMany: (args: Any) => Promise<CountResult> };
  order: { create: (args: Any) => Promise<OrderRow> };
  customer: { upsert: (args: Any) => Promise<unknown> };
  affiliate: { findFirst: (args: Any) => Promise<{ id: string; commissionPercent: number } | null> };
  affiliateCommission: { create: (args: Any) => Promise<unknown> };
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
      type: string;
      bookingSlotMinutes: number | null;
      bookingWorkingHours: unknown;
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
  vanexCity: {
    findUnique: (args: { where: { id: string } }) => Promise<{
      id: string;
      name: string;
      priceCents: number;
      vanexId: number;
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
    const { storeSlug, items, buyer, paymentMethod, couponCode, referralCode } = parsed.data;

    const store = await db.store.findUnique({ where: { slug: storeSlug }, include: { merchant: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    // Showcase stores have no checkout at all — catalog + inquiry only
    // (see POST /api/inquiries). The storefront UI never shows a cart for
    // one, but that's a UI choice, not a security boundary — a store that
    // switched to "showcase" after being created as "physical" would
    // otherwise still silently accept a real paid order through this
    // route via a stale client or a direct call.
    if (store.type === "showcase") {
      return NextResponse.json({ error: "هذا المتجر لا يدعم الشراء المباشر — يُرجى إرسال استفسار" }, { status: 400 });
    }

    // Rental: the buyer picked a date range, price = daily rate (the
    // product's own priceCents) × days × quantity — computed here, never
    // trusted from the client, and folded into unitPriceCents below so
    // every existing display of an order item (track page, dashboard,
    // confirmation) just works without knowing rental is a thing.
    let rentalDays = 1;
    let scheduledStartAt: Date | null = null;
    let scheduledEndAt: Date | null = null;
    if (store.type === "rental") {
      scheduledStartAt = parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : null;
      scheduledEndAt = parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt) : null;
      if (!scheduledStartAt || !scheduledEndAt || isNaN(scheduledStartAt.getTime()) || isNaN(scheduledEndAt.getTime())) {
        return NextResponse.json({ error: "تاريخ الاستلام والإرجاع مطلوبان" }, { status: 400 });
      }
      if (scheduledEndAt <= scheduledStartAt) {
        return NextResponse.json({ error: "تاريخ الإرجاع يجب أن يكون بعد تاريخ الاستلام" }, { status: 400 });
      }
      // Compared against the start of today (not the exact current
      // instant) so a same-day pickup is never wrongly rejected just
      // because it's already past midnight UTC.
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      if (scheduledStartAt < todayStart) {
        return NextResponse.json({ error: "تاريخ الاستلام لا يمكن أن يكون في الماضي" }, { status: 400 });
      }
      rentalDays = Math.max(1, Math.ceil((scheduledEndAt.getTime() - scheduledStartAt.getTime()) / 86_400_000));
    }

    // Booking: the buyer picked a slot start from the availability
    // endpoint's own output; the end is always recomputed here from the
    // store's own slot length — never trusted from the client. Actual
    // double-booking prevention is the partial unique index on
    // (storeId, scheduledStartAt) WHERE scheduledKind='booking' — this
    // isSlotOpen check is just an early, friendlier 400 for an obviously
    // bad request (off-hours, off-grid), not the real safety net.
    let scheduledKind: "booking" | "rental" | null = store.type === "rental" ? "rental" : null;
    if (store.type === "booking") {
      scheduledStartAt = parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : null;
      if (!scheduledStartAt || isNaN(scheduledStartAt.getTime())) {
        return NextResponse.json({ error: "اختر موعدًا" }, { status: 400 });
      }
      const slotMinutes = store.bookingSlotMinutes ?? 0;
      if (!isSlotOpen(scheduledStartAt, store.bookingWorkingHours as WorkingHours | null, slotMinutes)) {
        return NextResponse.json({ error: "هذا الموعد غير متاح، اختر موعدًا آخر" }, { status: 400 });
      }
      scheduledEndAt = new Date(scheduledStartAt.getTime() + slotMinutes * 60_000);
      scheduledKind = "booking";
    }

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
    let vanexShipping: { cityId: number; subCityId?: number } | undefined;
    if (buyer.vanexAreaId) {
      const area = await db.vanexArea.findUnique({ where: { id: buyer.vanexAreaId }, include: { city: true } });
      if (!area) return NextResponse.json({ error: "المنطقة المختارة غير صالحة" }, { status: 400 });
      shippingCents = area.priceCents;
      buyerCity = `${area.city.name} - ${area.name}`;
      vanexShipping = { cityId: area.city.vanexId, subCityId: area.vanexId };
    } else if (buyer.vanexCityId) {
      // No specific area picked — price at the city's own flat Vanex rate
      // rather than defaulting to free shipping, and still hand the real
      // Vanex integration a city id so a real shipment gets created.
      const city = await db.vanexCity.findUnique({ where: { id: buyer.vanexCityId } });
      if (!city) return NextResponse.json({ error: "المدينة المختارة غير صالحة" }, { status: 400 });
      shippingCents = city.priceCents;
      buyerCity = city.name;
      vanexShipping = { cityId: city.vanexId };
    }

    let order: OrderRow;
    try {
      order = await db.$transaction(
        async (tx: OrdersTx): Promise<OrderRow> => {
          const resolvedItems: ResolvedItem[] = [];
          const stockDecrements: StockDecrement[] = [];

          for (const { productId, bundleId, quantity, variantId } of items) {
            if (bundleId) {
              const bundle = await tx.bundle.findFirst({
                where: { id: bundleId, storeId: store.id, active: true },
                include: { items: { include: { product: true } } },
              });
              if (!bundle) throw new ProductNotFoundError(`Bundle ${bundleId} not found in this store`);

              for (const component of bundle.items) {
                const neededQty = component.quantity * quantity;
                if (component.product.trackInventory && component.product.stockQty < neededQty) {
                  throw new OutOfStockError(component.product.name);
                }
                stockDecrements.push({
                  kind: "product",
                  productId: component.productId,
                  quantity: neededQty,
                  trackInventory: component.product.trackInventory,
                  name: component.product.name,
                });
              }

              resolvedItems.push({
                productId: null,
                productName: bundle.name,
                unitPriceCents: bundle.priceCents * rentalDays,
                quantity,
                variantId: null,
                variantLabel: null,
                bundleId: bundle.id,
                bundleName: bundle.name,
                bundleItemsSnapshot: bundle.items.map((c) => ({ productName: c.product.name, quantity: c.quantity })),
              });
              continue;
            }

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
              productId: product.id,
              productName: product.name,
              unitPriceCents: (variant?.priceCents ?? product.priceCents) * rentalDays,
              quantity,
              variantId: variant?.id ?? null,
              variantLabel: variant ? Object.entries(variant.options).map(([k, v]) => `${k}: ${v}`).join("، ") : null,
              bundleId: null,
              bundleName: null,
              bundleItemsSnapshot: null,
            });
            stockDecrements.push(
              variant
                ? { kind: "variant", variantId: variant.id, quantity, name: product.name }
                : { kind: "product", productId: product.id, quantity, trackInventory: product.trackInventory, name: product.name }
            );
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
            // The validity check above reads usageCount as of the start of
            // this transaction — under concurrent checkout (two buyers
            // racing for the last use of a maxUsage coupon), both could
            // read a count that still looks valid. Guarding the increment
            // itself with the same condition makes the check-and-increment
            // atomic at the database level: whichever transaction commits
            // second sees the row it would increment no longer match, and
            // the count comes back 0 instead of silently overshooting
            // maxUsage.
            const couponUsageGuard = coupon.maxUsage != null ? { usageCount: { lt: coupon.maxUsage } } : {};
            const couponIncrement = await tx.coupon.updateMany({
              where: { id: coupon.id, ...couponUsageGuard },
              data: { usageCount: { increment: 1 } },
            });
            if (couponIncrement.count === 0) throw new InvalidCouponError("تم استخدام هذا الكوبون بالكامل");
          }

          const totalCents = productSubtotalCents - discountCents + shippingCents;

          // An affiliate's ?ref=CODE — an unrecognized or inactive code is
          // silently ignored (never a reason to fail checkout; it's a
          // marketing attribution signal, not part of the order's own
          // validity), matching the comment on referralCode in
          // createOrderSchema. appliedAffiliateCode mirrors
          // appliedCouponCode above: only the code that actually matched
          // gets denormalized onto the order, never raw client input.
          let affiliateId: string | null = null;
          let appliedAffiliateCode: string | null = null;
          let affiliateCommissionCents = 0;
          if (referralCode) {
            const affiliate = await tx.affiliate.findFirst({
              where: { storeId: store.id, code: referralCode.trim().toUpperCase(), active: true },
            });
            if (affiliate) {
              affiliateId = affiliate.id;
              appliedAffiliateCode = referralCode.trim().toUpperCase();
              affiliateCommissionCents = Math.round((totalCents * affiliate.commissionPercent) / 100);
            }
          }

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
              affiliateCode: appliedAffiliateCode,
              totalCents,
              shippingCents,
              vanexAreaId: buyer.vanexAreaId || null,
              scheduledStartAt,
              scheduledEndAt,
              scheduledKind,
              items: { create: resolvedItems },
            },
          });

          if (affiliateId) {
            await tx.affiliateCommission.create({
              data: { affiliateId, orderId: created.id, commissionCents: affiliateCommissionCents },
            });
          }

          // Same race as the coupon guard above, for physical stock: the
          // stock-sufficiency check on resolvedItems above ran against a
          // read from before this transaction started, so under
          // concurrent checkout for the last unit of stock, two orders
          // could both pass it. The decrement itself is the authoritative
          // check — `gte: quantity` in the WHERE makes "is there enough
          // stock" and "take it" one atomic database operation, so only
          // one of two racing orders can ever win the last unit; the
          // other gets count 0 and a real 409, instead of both succeeding
          // and overselling.
          for (const d of stockDecrements) {
            if (d.kind === "variant") {
              const decremented = await tx.productVariant.updateMany({
                where: { id: d.variantId, stockQty: { gte: d.quantity } },
                data: { stockQty: { decrement: d.quantity } },
              });
              if (decremented.count === 0) throw new OutOfStockError(d.name);
              await tx.productVariant.updateMany({ where: { id: d.variantId, stockQty: { lte: 0 } }, data: { active: false } });
              continue;
            }
            if (!d.trackInventory) continue;
            const decremented = await tx.product.updateMany({
              where: { id: d.productId, stockQty: { gte: d.quantity } },
              data: { stockQty: { decrement: d.quantity } },
            });
            if (decremented.count === 0) throw new OutOfStockError(d.name);
            await tx.product.updateMany({ where: { id: d.productId, stockQty: { lte: 0 } }, data: { active: false } });
          }

          // The merchant's buyer list — upserted in this same transaction
          // so orderCount/totalSpentCents can never drift from what was
          // actually ordered. name/email/city are kept fresh to the most
          // recent order rather than frozen at this buyer's first purchase.
          await tx.customer.upsert({
            where: { storeId_phone: { storeId: store.id, phone: buyer.phone } },
            create: {
              storeId: store.id,
              phone: buyer.phone,
              name: buyer.name,
              email: buyer.email || null,
              city: buyerCity,
              orderCount: 1,
              totalSpentCents: totalCents,
              lastOrderAt: new Date(),
            },
            update: {
              name: buyer.name,
              email: buyer.email || null,
              city: buyerCity,
              orderCount: { increment: 1 },
              totalSpentCents: { increment: totalCents },
              lastOrderAt: new Date(),
            },
          });

          return created;
        },
        { timeout: 15000, maxWait: 10000 }
      );
    } catch (err) {
      if (err instanceof OutOfStockError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof ProductNotFoundError) return NextResponse.json({ error: err.message }, { status: 400 });
      if (err instanceof InvalidCouponError) return NextResponse.json({ error: err.message }, { status: 400 });
      // The real safety net for double-booking: a concurrent order won
      // the race between this request's isSlotOpen check and its own
      // commit — the partial unique index on orders(storeId,
      // scheduledStartAt) WHERE scheduledKind='booking' catches it here
      // as a real Postgres unique-violation (code P2002), the same way
      // OutOfStockError's `gte` guard catches a stock race. Scoped to
      // store.type === "booking" specifically (not any P2002) so a
      // unique-constraint violation from somewhere else in the
      // transaction is never mislabeled as a booking conflict.
      if (store.type === "booking" && typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "هذا الموعد محجوز بالفعل، اختر موعدًا آخر" }, { status: 409 });
      }
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

    // Digital, rental, and booking stores have no courier delivery at all
    // — digital because there's no physical item to ship, rental because
    // pickup/return is handled by the merchant in person, booking because
    // the atomic slot reservation IS the confirmation moment — so the
    // order is confirmed immediately instead of waiting on a shipment
    // step that would never happen.
    if (store.type === "digital" || store.type === "rental" || store.type === "booking") {
      await db.order.update({ where: { id: order.id }, data: { status: "confirmed" } });

      await deps.sendOrderConfirmationEmail({
        id: order.id,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        totalCents,
        storeSlug: store.slug,
      });
      await deps.sendNewOrderSms(store.merchant.phone, order.id, order.buyerName);

      return NextResponse.json({ orderId: order.id, totalCents, shippingCents, discountCents, paymentStatus: "pending" }, { status: 201 });
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
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
