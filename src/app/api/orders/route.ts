import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createShipment } from "@/lib/integrations/couriers";
import { openDpaySession, DpayApiError } from "@/lib/payment/dpay-client";
import { createOrderSchema } from "@/lib/validation";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";
import { resolveCouponDiscount } from "@/lib/coupons";
import { sendOrderConfirmationEmail } from "@/lib/integrations/email";
import { sendNewOrderSms } from "@/lib/integrations/sms";

class OutOfStockError extends Error {
  constructor(productName: string) {
    super(`لا يوجد مخزون كافٍ من: ${productName}`);
  }
}

class ProductNotFoundError extends Error {}

class InvalidCouponError extends Error {}

// POST /api/orders — a buyer places an order from the storefront's checkout
// page. No auth required. Body shape matches the checkout form fields.
// Ported from marsa-backend/src/routes/orders.js (POST /), including the
// server-side price resolution (never trust prices sent from the client)
// and the courier/payment dispatch sequence.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeSlug, items, buyer, paymentMethod, dpayPayMethod, dpayCustomerMobile, dpayBirthYear, dpayCardNumber, couponCode } =
      parsed.data;

    const store = await prisma.store.findUnique({ where: { slug: storeSlug }, include: { merchant: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    if (paymentMethod === "wallet") {
      const dpayAvailable = getCheckoutPaymentMethods(getSubscriptionState(store.merchant)).dpay;
      if (!store.walletProvider || !dpayAvailable) {
        return NextResponse.json({ error: "This store has no wallet payment option enabled" }, { status: 400 });
      }
    }
    if (paymentMethod === "cod" && !store.codEnabled) {
      return NextResponse.json({ error: "This store does not accept cash on delivery" }, { status: 400 });
    }

    // Resolve the shipping destination/cost server-side too — never trust a
    // client-sent price. Only meaningful for vanex stores that went through
    // the checkout's zone/area picker.
    let shippingCents = 0;
    let buyerCity = buyer.city;
    let vanexShipping: { cityId: number; subCityId: number } | undefined;
    if (buyer.vanexAreaId) {
      const area = await prisma.vanexArea.findUnique({
        where: { id: buyer.vanexAreaId },
        include: { city: true },
      });
      if (!area) {
        return NextResponse.json({ error: "المنطقة المختارة غير صالحة" }, { status: 400 });
      }
      shippingCents = area.priceCents;
      buyerCity = `${area.city.name} - ${area.name}`;
      vanexShipping = { cityId: area.city.vanexId, subCityId: area.vanexId };
    }

    // Product lookup, stock check/decrement, and order creation happen
    // together in one transaction — this is the one place in the codebase a
    // transaction is actually needed: two buyers checking out the last unit
    // of a low-stock product concurrently could otherwise both pass a
    // "stock > 0" read before either write lands, overselling. Wallet
    // payment and courier calls stay outside (external HTTP, unpredictable
    // latency — must never sit inside a DB transaction).
    let order: Awaited<ReturnType<typeof prisma.order.create>>;
    try {
      order = await prisma.$transaction(async (tx) => {
        const resolvedItems: { product: NonNullable<Awaited<ReturnType<typeof tx.product.findFirst>>>; quantity: number }[] = [];
        for (const { productId, quantity } of items) {
          const product = await tx.product.findFirst({
            where: { id: productId, storeId: store.id, active: true },
          });
          if (!product) {
            throw new ProductNotFoundError(`Product ${productId} not found in this store`);
          }
          if (product.trackInventory && product.stockQty < quantity) {
            throw new OutOfStockError(product.name);
          }
          resolvedItems.push({ product, quantity });
        }

        const productSubtotalCents = resolvedItems.reduce((sum, { product, quantity }) => sum + product.priceCents * quantity, 0);

        // Never trust a client-sent discount — recompute authoritatively
        // against the coupon row, same principle already applied to prices
        // and shipping above.
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
              create: resolvedItems.map(({ product, quantity }) => ({
                productId: product.id,
                productName: product.name,
                unitPriceCents: product.priceCents,
                quantity,
              })),
            },
          },
        });

        for (const { product, quantity } of resolvedItems) {
          if (!product.trackInventory) continue;
          const remaining = product.stockQty - quantity;
          await tx.product.update({
            where: { id: product.id },
            data: { stockQty: remaining, ...(remaining <= 0 ? { active: false } : {}) },
          });
        }

        return created;
      }, { timeout: 15000, maxWait: 10000 });
    } catch (err) {
      if (err instanceof OutOfStockError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      if (err instanceof ProductNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      if (err instanceof InvalidCouponError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const totalCents = order.totalCents;
    const discountCents = order.discountCents;

    // Wallet orders open a DPay payment session instead of settling
    // synchronously — most gateways need the buyer to enter an OTP DPay
    // texts them directly (we never see it ourselves until the buyer
    // types it back to us), and Moamalat redirects to a hosted page
    // entirely. Only DPay's webhook (or, for a faster UI, the OTP-verify
    // call — see finalizeWalletOrder) ever flips paymentStatus to
    // paid/failed; nothing here assumes success.
    if (paymentMethod === "wallet") {
      let session;
      try {
        session = await openDpaySession({
          payMethod: dpayPayMethod!,
          totalCents,
          data: { order_id: order.id },
          customerMobile: dpayCustomerMobile,
          birthYear: dpayBirthYear,
          cardNumber: dpayCardNumber,
        });
      } catch (err) {
        const message = err instanceof DpayApiError ? err.message : "تعذّر بدء الدفع الإلكتروني";
        console.error(`DPay session open failed for order ${order.id}:`, err);
        return NextResponse.json({ error: message, orderId: order.id }, { status: 502 });
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          dpaySessionId: String(session.sessionId),
          dpayPayMethod,
          dpayFeeCents: session.feeCents,
          paymentStatus: session.status === "paid" ? "paid" : "pending",
        },
      });

      if (session.status !== "paid") {
        // Real session, awaiting OTP entry or the Moamalat redirect —
        // nothing to ship yet. See /api/dpay/verify-otp and /api/dpay/webhook.
        return NextResponse.json(
          {
            orderId: order.id,
            totalCents,
            shippingCents,
            discountCents,
            paymentStatus: "pending",
            dpay: {
              sessionId: session.sessionId,
              payMethod: dpayPayMethod,
              requiresOtp: dpayPayMethod !== "moamalat",
              paymentLink: session.paymentLink,
            },
          },
          { status: 201 }
        );
      }
      // Mock mode (no DPAY_API_TOKEN) resolves "paid" immediately — fall
      // through to the shared shipment/notify block below, same as COD.
    }

    // Hand off to the courier regardless of payment method — COD orders still
    // ship, the courier just collects cash on delivery instead.
    const shipment = await createShipment(store.courier, {
      id: order.id,
      buyer: { ...buyer, city: buyerCity },
      totalCents,
      paymentMethod,
      itemsCount: items.reduce((sum, { quantity }) => sum + quantity, 0),
      vanex: vanexShipping,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "confirmed", courierTrackingId: shipment.trackingId },
    });

    // Best-effort, outside the transaction (external HTTP) — a failed send
    // never fails the order itself, see sendOrderConfirmationEmail's own
    // try/catch.
    await sendOrderConfirmationEmail({
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      totalCents,
      courierTrackingId: shipment.trackingId,
    });
    await sendNewOrderSms(store.merchant.phone, order.id, order.buyerName);

    return NextResponse.json(
      {
        orderId: order.id,
        totalCents,
        shippingCents,
        discountCents,
        trackingId: shipment.trackingId,
        courier: store.courier,
        paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
