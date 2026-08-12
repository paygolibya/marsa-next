import { NextResponse } from "next/server";
import { verifyBuyerOrder } from "@/lib/verify-buyer";

// GET /api/orders/track?orderId=...&phone=... — public, no accounts.
// Returns a restricted view — never the full order row (no buyerAddress,
// no echoing buyerPhone back beyond what was submitted).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = url.searchParams.get("orderId");
  const phone = url.searchParams.get("phone");
  if (!orderId || !phone) {
    return NextResponse.json({ error: "orderId and phone are required" }, { status: 400 });
  }

  const order = await verifyBuyerOrder(orderId, phone);
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
    items: order.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
  });
}
