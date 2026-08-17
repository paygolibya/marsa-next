import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail } from "@/lib/integrations/email";
import { sendShipmentStatusSms } from "@/lib/integrations/sms";
import { calculateCommissionForOrder } from "@/lib/payment/payout-processor";

// POST /api/vanex/webhook — Vanex pushes shipment status changes here.
// Auth is a shared secret header, not a merchant/admin token, since Vanex
// itself is the caller.
//
// Unlike the fire-and-forget "respond first, process async" pattern some
// courier docs suggest, we await the DB updates before responding — a
// Vercel serverless function can be frozen immediately after it returns a
// response, which would silently drop any work still in flight.
export async function POST(req: Request) {
  const webhookKey = req.headers.get("x-webhook-key");
  if (!webhookKey || webhookKey !== process.env.VANEX_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { type?: string; packages?: { code: string; non_delivery_reason?: string }[]; ref_number?: string; amount?: number; time_stamp?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, packages, time_stamp } = body;
  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  if (type === "settlement") {
    // Financial settlement between Vanex and the platform account — not
    // tied to any single order, nothing to update.
    return NextResponse.json({ success: true });
  }

  const statusAt = time_stamp ? new Date(time_stamp) : new Date();

  const statusByType: Record<string, string> = {
    package_accepted: "accepted",
    package_delivered: "delivered",
    package_failed_delivery: "failed_delivery",
    packages_returned: "returned",
  };
  const courierStatus = statusByType[type];
  if (!courierStatus) {
    console.warn(`Vanex webhook: unknown type "${type}"`);
    return NextResponse.json({ success: true });
  }

  for (const pkg of packages || []) {
    try {
      const matches = await prisma.order.findMany({ where: { courierTrackingId: pkg.code } });
      if (matches.length === 0) {
        console.warn(`Vanex webhook: no order matched tracking id ${pkg.code}`);
        continue;
      }

      for (const order of matches) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            courierStatus,
            courierStatusAt: statusAt,
            courierNote: pkg.non_delivery_reason,
            ...(courierStatus === "delivered" ? { status: "delivered" } : {}),
          },
        });
        // Best-effort — a failed send never fails the webhook itself.
        await sendOrderStatusEmail(
          { id: order.id, buyerName: order.buyerName, buyerEmail: order.buyerEmail, totalCents: order.totalCents },
          courierStatus
        );
        await sendShipmentStatusSms(order.buyerPhone, courierStatus, order.courierTrackingId);

        // Real-time payout trigger — the moment an order is marked
        // delivered, calculate its commission automatically (no admin
        // action). No-ops for COD orders (not eligible) and is safe to
        // call unconditionally; the daily cron re-covers anything this
        // best-effort call fails to complete.
        if (courierStatus === "delivered") {
          try {
            await calculateCommissionForOrder(order.id);
          } catch (error) {
            console.error(`Vanex webhook: commission calculation failed for order ${order.id}:`, error);
          }
        }
      }
    } catch (error) {
      // One bad/unmatched package shouldn't fail the whole batch — Vanex
      // would just retry-storm the entire payload.
      console.error(`Vanex webhook: failed to process package ${pkg.code}:`, error);
    }
  }

  return NextResponse.json({ success: true });
}
