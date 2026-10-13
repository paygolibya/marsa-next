import { prisma } from "@/lib/prisma";
import { sendMerchantNewOrderEmail, sendMerchantLowStockEmail } from "@/lib/integrations/email";
import { sendPushToMerchant } from "@/lib/integrations/push";

// Creates the in-app Notification row and fires the email + push alerts —
// the one place any of these happens, called from every order-confirmation
// path (src/app/api/orders/handler.ts, src/lib/payment/moamalat-order.ts)
// and the low-stock crossing check in orders/handler.ts's stock-decrement
// loop. Deliberately NOT part of the order-creation DB transaction — these
// are best-effort side effects on top of an already-committed order/stock
// change, same treatment the existing SMS/email calls already get; a
// notification-service hiccup must never roll back a real order.
type NotifyMerchant = { id: string; email: string | null; name: string };

export async function notifyMerchantNewOrder(
  merchant: NotifyMerchant,
  order: { id: string; buyerName: string; totalCents: number; storeId: string }
): Promise<void> {
  const title = "لديك طلب جديد";
  const body = `طلب رقم ${order.id} من ${order.buyerName}`;
  const link = "/dashboard/orders";

  try {
    await prisma.notification.create({ data: { merchantId: merchant.id, storeId: order.storeId, type: "new_order", title, body, link } });
  } catch (error) {
    console.error("notifyMerchantNewOrder: failed to write Notification row:", error);
  }
  await Promise.all([sendMerchantNewOrderEmail(merchant, order), sendPushToMerchant(merchant.id, { title, body, link })]);
}

export async function notifyMerchantLowStock(
  merchant: NotifyMerchant,
  product: { id: string; name: string; stockQty: number; storeId: string }
): Promise<void> {
  const title = "تنبيه: كمية منخفضة";
  const body = `الكمية المتبقية من "${product.name}" أصبحت ${product.stockQty}`;
  const link = "/dashboard/products";

  try {
    await prisma.notification.create({ data: { merchantId: merchant.id, storeId: product.storeId, type: "low_stock", title, body, link } });
  } catch (error) {
    console.error("notifyMerchantLowStock: failed to write Notification row:", error);
  }
  await Promise.all([sendMerchantLowStockEmail(merchant, product), sendPushToMerchant(merchant.id, { title, body, link })]);
}
