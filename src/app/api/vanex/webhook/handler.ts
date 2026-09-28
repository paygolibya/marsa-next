import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isValidVanexWebhookKey, resolveVanexCourierStatus } from "@/lib/integrations/vanex-webhook";

type OrderLike = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string;
  totalCents: number;
  courierTrackingId: string | null;
};

// The exact slice of the Prisma client (plus the three external-effect
// functions this route calls) that this handler touches — injected so
// tests can supply fakes and verify the route's own logic (auth, package-
// to-order matching, the "settlement"/unknown-type short-circuits, the
// delivered-only commission trigger) without a real database OR any real
// network calls to SendGrid/SMS/etc. route.ts's POST is the only thing
// Next.js itself calls; it forwards here with the real dependencies. (Not
// in route.ts itself — Next's route-file export validation only allows
// known handler names, and rejects any other export.)
export type VanexWebhookDeps = {
  db: {
    order: {
      findMany: (args: { where: { courierTrackingId: string } }) => Promise<OrderLike[]>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
  };
  sendOrderStatusEmail: (order: { id: string; buyerName: string; buyerEmail: string | null; totalCents: number }, status: string) => Promise<void>;
  sendShipmentStatusSms: (phone: string, status: string, trackingId: string | null) => Promise<unknown>;
  calculateCommissionForOrder: (orderId: string) => Promise<{ created: boolean; reason?: string }>;
};

export async function handleVanexWebhook(deps: VanexWebhookDeps, req: Request): Promise<Response> {
  const webhookKey = req.headers.get("x-webhook-key");
  if (!isValidVanexWebhookKey(webhookKey, process.env.VANEX_WEBHOOK_SECRET)) {
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
    return NextResponse.json({ success: true });
  }

  const statusAt = time_stamp ? new Date(time_stamp) : new Date();

  const courierStatus = resolveVanexCourierStatus(type);
  if (!courierStatus) {
    console.warn(`Vanex webhook: unknown type "${type}"`);
    return NextResponse.json({ success: true });
  }

  for (const pkg of packages || []) {
    try {
      const matches = await deps.db.order.findMany({ where: { courierTrackingId: pkg.code } });
      if (matches.length === 0) {
        console.warn(`Vanex webhook: no order matched tracking id ${pkg.code}`);
        continue;
      }

      for (const order of matches) {
        await deps.db.order.update({
          where: { id: order.id },
          data: {
            courierStatus,
            courierStatusAt: statusAt,
            courierNote: pkg.non_delivery_reason,
            ...(courierStatus === "delivered" ? { status: "delivered" } : {}),
          },
        });
        await deps.sendOrderStatusEmail(
          { id: order.id, buyerName: order.buyerName, buyerEmail: order.buyerEmail, totalCents: order.totalCents },
          courierStatus
        );
        await deps.sendShipmentStatusSms(order.buyerPhone, courierStatus, order.courierTrackingId);

        if (courierStatus === "delivered") {
          try {
            await deps.calculateCommissionForOrder(order.id);
          } catch (error) {
            console.error(`Vanex webhook: commission calculation failed for order ${order.id}:`, error);
            Sentry.captureException(error);
          }
        }
      }
    } catch (error) {
      console.error(`Vanex webhook: failed to process package ${pkg.code}:`, error);
      Sentry.captureException(error);
    }
  }

  return NextResponse.json({ success: true });
}
