import { NextResponse } from "next/server";

type OrderRow = {
  status: string;
  courierStatus: string | null;
  courierStatusAt: Date | null;
  courierNote: string | null;
  courierTrackingId: string | null;
  totalCents: number;
  shippingCents: number;
  createdAt: Date;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  items: { id: string; productId: string; productName: string; unitPriceCents: number; quantity: number; variantLabel: string | null }[];
};

export type TrackOrderDeps = {
  verifyBuyerOrder: (orderId: string, phone: string) => Promise<OrderRow | null>;
};

// GET /api/orders/track?orderId=...&phone=... — public, no accounts.
// Returns a restricted view — never the full order row (no buyerAddress,
// no echoing buyerPhone back beyond what was submitted). verifyBuyerOrder
// is the actual security boundary here (order id + the matching phone,
// not just the id alone — an unguessable cuid still shouldn't be enough
// on its own), so it's injectable to test that boundary without a real DB.
export async function handleTrackOrder(deps: TrackOrderDeps, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const phone = url.searchParams.get("phone");
  if (!orderId || !phone) {
    return NextResponse.json({ error: "orderId and phone are required" }, { status: 400 });
  }

  const order = await deps.verifyBuyerOrder(orderId, phone);
  if (!order) {
    return NextResponse.json({ error: "لم يتم العثور على طلب مطابق" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    courierStatus: order.courierStatus,
    courierStatusAt: order.courierStatusAt,
    courierNote: order.courierNote,
    courierTrackingId: order.courierTrackingId,
    totalCents: order.totalCents,
    shippingCents: order.shippingCents,
    createdAt: order.createdAt,
    scheduledStartAt: order.scheduledStartAt,
    scheduledEndAt: order.scheduledEndAt,
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      variantLabel: i.variantLabel,
    })),
  });
}
