// Pure merge of the storefront's two "best seller" sources, extracted so
// the ranking rule (pinned always first, auto-ranked fills the rest, no
// product ever appears twice) is unit-testable without a database — same
// rationale as pickTopProducts in analytics.ts.

export type SoldCount = { productId: string; quantity: number };

export function rankBestSellers<T extends { id: string; isBestSeller: boolean }>(
  products: T[],
  soldCounts: SoldCount[],
  limit: number
): T[] {
  const pinned = products.filter((p) => p.isBestSeller);
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const byId = new Map(products.map((p) => [p.id, p]));

  const autoRanked = [...soldCounts]
    .filter((s) => !pinnedIds.has(s.productId) && byId.has(s.productId))
    .sort((a, b) => b.quantity - a.quantity)
    .map((s) => byId.get(s.productId)!);

  return [...pinned, ...autoRanked].slice(0, Math.max(0, limit));
}
