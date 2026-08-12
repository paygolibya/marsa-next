import { prisma } from "@/lib/prisma";

// Shared identity check for the no-accounts buyer flows (order tracking,
// review submission): an order id (an unguessable cuid) plus the phone
// number that was entered at checkout. No magic links, no email
// dependency — phone is the one identifier every order already has.
function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

export async function verifyBuyerOrder(orderId: string, phone: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return null;
  if (normalizePhone(order.buyerPhone) !== normalizePhone(phone)) return null;
  return order;
}
