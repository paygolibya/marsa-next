import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  for (const pkg of packages || []) {
    try {
      switch (type) {
        case "package_accepted":
          await prisma.order.updateMany({
            where: { courierTrackingId: pkg.code },
            data: { courierStatus: "accepted", courierStatusAt: statusAt },
          });
          break;
        case "package_delivered":
          await prisma.order.updateMany({
            where: { courierTrackingId: pkg.code },
            data: { courierStatus: "delivered", courierStatusAt: statusAt, status: "delivered" },
          });
          break;
        case "package_failed_delivery":
          await prisma.order.updateMany({
            where: { courierTrackingId: pkg.code },
            data: { courierStatus: "failed_delivery", courierStatusAt: statusAt, courierNote: pkg.non_delivery_reason },
          });
          break;
        case "packages_returned":
          await prisma.order.updateMany({
            where: { courierTrackingId: pkg.code },
            data: { courierStatus: "returned", courierStatusAt: statusAt, courierNote: pkg.non_delivery_reason },
          });
          break;
        default:
          console.warn(`Vanex webhook: unknown type "${type}" for package ${pkg.code}`);
      }
    } catch (error) {
      // One bad/unmatched package shouldn't fail the whole batch — Vanex
      // would just retry-storm the entire payload.
      console.error(`Vanex webhook: failed to process package ${pkg.code}:`, error);
    }
  }

  return NextResponse.json({ success: true });
}
