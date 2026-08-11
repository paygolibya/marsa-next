import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createShipment } from "@/lib/integrations/couriers";
import { initiateWalletPayment } from "@/lib/integrations/payments";
import { createOrderSchema } from "@/lib/validation";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";

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
    const { storeSlug, items, buyer, paymentMethod } = parsed.data;

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

    // Look up real prices server-side — never trust prices sent from the client.
    const resolvedItems: { product: Awaited<ReturnType<typeof prisma.product.findFirst>>; quantity: number }[] = [];
    for (const { productId, quantity } of items) {
      const product = await prisma.product.findFirst({
        where: { id: productId, storeId: store.id, active: true },
      });
      if (!product) {
        return NextResponse.json({ error: `Product ${productId} not found in this store` }, { status: 400 });
      }
      resolvedItems.push({ product, quantity });
    }

    const productSubtotalCents = resolvedItems.reduce(
      (sum, { product, quantity }) => sum + (product!.priceCents * quantity),
      0
    );

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

    const totalCents = productSubtotalCents + shippingCents;

    // Create the order + order items together.
    const order = await prisma.order.create({
      data: {
        storeId: store.id,
        buyerName: buyer.name,
        buyerPhone: buyer.phone,
        buyerCity,
        buyerAddress: buyer.address,
        paymentMethod,
        paymentStatus: "pending",
        status: "pending",
        totalCents,
        shippingCents,
        vanexAreaId: buyer.vanexAreaId || null,
        items: {
          create: resolvedItems.map(({ product, quantity }) => ({
            productId: product!.id,
            productName: product!.name,
            unitPriceCents: product!.priceCents,
            quantity,
          })),
        },
      },
    });

    // Wallet payments settle immediately (or fail) before we confirm the order.
    if (paymentMethod === "wallet") {
      const payment = await initiateWalletPayment({ id: order.id, totalCents });
      await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: payment.status } });
      if (payment.status !== "paid") {
        return NextResponse.json({ error: "Payment failed", orderId: order.id }, { status: 402 });
      }
    }

    // Hand off to the courier regardless of payment method — COD orders still
    // ship, the courier just collects cash on delivery instead.
    const shipment = await createShipment(store.courier, {
      id: order.id,
      buyer: { ...buyer, city: buyerCity },
      totalCents,
      paymentMethod,
      itemsCount: resolvedItems.reduce((sum, { quantity }) => sum + quantity, 0),
      vanex: vanexShipping,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "confirmed", courierTrackingId: shipment.trackingId },
    });

    return NextResponse.json(
      {
        orderId: order.id,
        totalCents,
        shippingCents,
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
