// Self-service account deletion (App Store Guideline 5.1.1(v): an app
// that lets people create an account must let them delete it, and its
// data, from inside the app). Order matters because several relations are
// RESTRICT rather than CASCADE in schema.prisma:
//   OrderItem → Order, Order → Store, Product → Store, Store → Merchant,
//   Commission → Payout, BugReport / ImpersonationSession → Merchant.
// Everything runs in one transaction, so a failure part-way leaves the
// account exactly as it was instead of half-deleted.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the real
// Prisma transaction client; args stay loose like orders/handler.ts.
type Any = any;

export type DeleteAccountTx = {
  store: { findMany: (args: Any) => Promise<{ id: string }[]>; deleteMany: (args: Any) => Promise<unknown> };
  orderItem: { deleteMany: (args: Any) => Promise<unknown> };
  order: { deleteMany: (args: Any) => Promise<unknown> };
  product: { deleteMany: (args: Any) => Promise<unknown> };
  commission: { deleteMany: (args: Any) => Promise<unknown> };
  payout: { deleteMany: (args: Any) => Promise<unknown> };
  bugReport: { deleteMany: (args: Any) => Promise<unknown> };
  impersonationSession: { deleteMany: (args: Any) => Promise<unknown> };
  merchant: { delete: (args: Any) => Promise<unknown> };
};

export async function deleteMerchantData(tx: DeleteAccountTx, merchantId: string): Promise<{ storesDeleted: number }> {
  const stores = await tx.store.findMany({ where: { merchantId }, select: { id: true } });
  const storeIds = stores.map((s) => s.id);
  if (storeIds.length > 0) {
    await tx.orderItem.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
    // Cascades Commission / AffiliateCommission / ProductReview rows tied to these orders.
    await tx.order.deleteMany({ where: { storeId: { in: storeIds } } });
    // Cascades variants, bundle items, reviews, upsells; inquiries keep a null productId.
    await tx.product.deleteMany({ where: { storeId: { in: storeIds } } });
    // Cascades everything else hanging off a store (categories, bundles, pages, coupons, customers, analytics…).
    await tx.store.deleteMany({ where: { merchantId } });
  }
  // Commission → Payout is RESTRICT: clear commissions before payouts.
  await tx.commission.deleteMany({ where: { merchantId } });
  await tx.payout.deleteMany({ where: { merchantId } });
  await tx.bugReport.deleteMany({ where: { merchantId } });
  await tx.impersonationSession.deleteMany({ where: { merchantId } });
  // Cascades payments, notifications, push subscriptions, support conversations.
  await tx.merchant.delete({ where: { id: merchantId } });
  return { storesDeleted: storeIds.length };
}
