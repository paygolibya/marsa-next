import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { COURIER_STATUS_FOR_DELIVERY_STATUS, type DeliveryStatus } from "@/lib/delivery/own-team";
import { amountToCollectCents } from "../../handler";

type OrderRow = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerPhone: string;
  totalCents: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  deliveryServiceLevel: string | null;
  deliveryStatus: string | null;
};

export type DriverStatusDeps = {
  db: {
    order: {
      findUnique: (args: { where: { id: string } }) => Promise<OrderRow | null>;
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    };
  };
  isDriver: (merchantId: string | null) => Promise<boolean>;
  sendOrderStatusEmail: (order: { id: string; buyerName: string; buyerEmail: string | null; totalCents: number }, status: string) => Promise<void>;
  sendShipmentStatusSms: (phone: string, status: string, trackingId: string | null) => Promise<unknown>;
  calculateCommissionForOrder: (orderId: string) => Promise<{ created: boolean; reason?: string }>;
  now?: () => Date;
};

const DRIVER_SETTABLE: DeliveryStatus[] = ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];

// POST /api/driver/orders/:id/status — { status, cashCollectedCents? }.
// Records an own-team delivery step. Mirrors what the Vanex webhook does
// for the equivalent courier event (vanex/webhook/handler.ts): the same
// courierStatus value, the same buyer email/SMS, and on delivery the same
// order.status = "delivered" + commission calculation — so the rest of the
// order flow can't tell an own-team delivery from a Vanex one.
export async function handleUpdateDriverStatus(deps: DriverStatusDeps, req: Request, orderId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await deps.isDriver(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: unknown; cashCollectedCents?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status as DeliveryStatus;
  if (!DRIVER_SETTABLE.includes(status)) {
    return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
  }

  try {
    const order = await deps.db.order.findUnique({ where: { id: orderId } });
    if (!order || !order.deliveryServiceLevel) {
      return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      return NextResponse.json({ error: "هذا الطلب ملغى" }, { status: 400 });
    }
    if (order.deliveryStatus === "DELIVERED") {
      return NextResponse.json({ error: "تم تسليم هذا الطلب مسبقًا" }, { status: 409 });
    }

    const now = deps.now ? deps.now() : new Date();
    const data: Record<string, unknown> = { deliveryStatus: status, deliveryCourierId: merchantId };

    if (status === "DELIVERED") {
      const due = amountToCollectCents(order);
      const collected = body.cashCollectedCents;
      if (due > 0 && (typeof collected !== "number" || !Number.isInteger(collected) || collected < 0)) {
        return NextResponse.json({ error: "أدخل المبلغ المحصّل" }, { status: 400 });
      }
      data.cashCollectedCents = due > 0 ? collected : 0;
      data.cashCollectedAt = now;
      data.status = "delivered";
    }

    const courierStatus = COURIER_STATUS_FOR_DELIVERY_STATUS[status];
    if (courierStatus) {
      data.courierStatus = courierStatus;
      data.courierStatusAt = now;
    }

    await deps.db.order.update({ where: { id: order.id }, data });

    if (courierStatus) {
      await deps.sendOrderStatusEmail(
        { id: order.id, buyerName: order.buyerName, buyerEmail: order.buyerEmail, totalCents: order.totalCents },
        courierStatus
      );
      await deps.sendShipmentStatusSms(order.buyerPhone, courierStatus, null);
    }

    if (status === "DELIVERED") {
      try {
        await deps.calculateCommissionForOrder(order.id);
      } catch (error) {
        console.error(`Driver status: commission calculation failed for order ${order.id}:`, error);
        Sentry.captureException(error);
      }
    }

    return NextResponse.json({ success: true, deliveryStatus: status });
  } catch (error) {
    console.error("Error updating driver status:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
