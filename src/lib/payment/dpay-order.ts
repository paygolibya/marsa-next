import { prisma } from "@/lib/prisma";
import { createShipment } from "@/lib/integrations/couriers";
import { sendOrderConfirmationEmail } from "@/lib/integrations/email";
import { sendNewOrderSms } from "@/lib/integrations/sms";

export type FinalizeWalletOrderResult = {
  updated: boolean; // false = already finalized by a concurrent call (webhook + OTP-verify racing, or a duplicate webhook delivery) — a safe no-op, not an error
  trackingId?: string;
  courier?: string;
};

/**
 * The single place a wallet order's paymentStatus is ever written after
 * creation, and the single place its shipment gets created. Called from
 * two independent triggers that can race each other — the customer
 * completing OTP verification (src/app/api/dpay/verify-otp/route.ts) and
 * DPay's own webhook (src/app/api/dpay/webhook/route.ts) — whichever
 * confirms first wins; the other becomes a no-op via the atomic
 * `paymentStatus: "pending"` guard below, not a duplicate shipment.
 */
export async function finalizeWalletOrder(orderId: string, outcome: "paid" | "failed"): Promise<FinalizeWalletOrderResult> {
  const guarded = await prisma.order.updateMany({
    where: { id: orderId, paymentMethod: "wallet", paymentStatus: "pending" },
    data: { paymentStatus: outcome },
  });
  if (guarded.count === 0) return { updated: false };
  if (outcome !== "paid") return { updated: true };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { select: { quantity: true } },
      store: { select: { courier: true, merchant: { select: { phone: true } } } },
      vanexArea: { select: { vanexId: true, city: { select: { vanexId: true } } } },
    },
  });
  if (!order) return { updated: true };

  // Shipment creation and notifications are best-effort on top of an
  // already-recorded payment — a courier or SMS/email outage must never
  // make it look like the payment itself failed.
  try {
    const shipment = await createShipment(order.store.courier, {
      id: order.id,
      buyer: { name: order.buyerName, phone: order.buyerPhone, city: order.buyerCity, address: order.buyerAddress },
      totalCents: order.totalCents,
      paymentMethod: "wallet",
      itemsCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
      vanex: order.vanexArea ? { cityId: order.vanexArea.city.vanexId, subCityId: order.vanexArea.vanexId } : undefined,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "confirmed", courierTrackingId: shipment.trackingId },
    });
    await sendOrderConfirmationEmail({
      id: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      totalCents: order.totalCents,
      courierTrackingId: shipment.trackingId,
    });
    await sendNewOrderSms(order.store.merchant.phone, order.id, order.buyerName);
    return { updated: true, trackingId: shipment.trackingId, courier: order.store.courier };
  } catch (error) {
    console.error(`finalizeWalletOrder: shipment/notification failed for order ${orderId} (payment already recorded as paid):`, error);
    return { updated: true };
  }
}
