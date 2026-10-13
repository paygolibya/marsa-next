import { prisma } from "@/lib/prisma";
import { sendMerchantNewOrderEmail, sendMerchantLowStockEmail } from "@/lib/integrations/email";

// Creates the in-app Notification row and fires the email alert — the one
// place either of these happens, called from every order-confirmation path
// (src/app/api/orders/handler.ts, src/lib/payment/moamalat-order.ts) and
// the low-stock crossing check in orders/handler.ts's stock-decrement loop.
// Deliberately NOT part of the order-creation DB transaction — these are
// best-effort side effects on top of an already-committed order/stock
// change, same treatment the existing SMS/email calls already get; a
// notification-service hiccup must never roll back a real order.
// (Push notifications join this function in a later phase.)
type NotifyMerchant = { id: string; email: string | null; name: string };

export async function notifyMerchantNewOrder(
  merchant: NotifyMerchant,
  order: { id: string; buyerName: string; totalCents: number; storeId: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        merchantId: merchant.id,
        storeId: order.storeId,
        type: "new_order",
        title: "لديك طلب جديد",
        body: `طلب رقم ${order.id} من ${order.buyerName}`,
        link: "/dashboard/orders",
      },
    });
  } catch (error) {
    console.error("notifyMerchantNewOrder: failed to write Notification row:", error);
  }
  await sendMerchantNewOrderEmail(merchant, order);
}

export async function notifyMerchantLowStock(
  merchant: NotifyMerchant,
  product: { id: string; name: string; stockQty: number; storeId: string }
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        merchantId: merchant.id,
        storeId: product.storeId,
        type: "low_stock",
        title: "تنبيه: كمية منخفضة",
        body: `الكمية المتبقية من "${product.name}" أصبحت ${product.stockQty}`,
        link: "/dashboard/products",
      },
    });
  } catch (error) {
    console.error("notifyMerchantLowStock: failed to write Notification row:", error);
  }
  await sendMerchantLowStockEmail(merchant, product);
}
