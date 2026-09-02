import { prisma } from "@/lib/prisma";

/**
 * Subscription access — trial or paid, they share the same
 * subscriptionEndDate — has never actually been enforced anywhere in this
 * codebase until now: the accept/payment-approval routes set
 * subscriptionEndDate 30 (or, for a new trial, 90) days out, but nothing
 * ever checked whether that date had passed. This is that check, called
 * two ways:
 *  - lazily, from /api/auth/me (so a merchant sees the real state the
 *    moment they load their dashboard, not up to a day later)
 *  - from the daily cron (src/app/api/cron/expire-subscriptions), so the
 *    admin's merchant list reflects reality even for a merchant who
 *    hasn't logged back in
 * Both call the same function so there's exactly one place this logic
 * lives, and exactly one guard (`subscriptionStatus: "active"` in the
 * `where`) against redundant/concurrent writes.
 */
export async function expireIfLapsed(merchantId: string): Promise<boolean> {
  const result = await prisma.merchant.updateMany({
    where: { id: merchantId, subscriptionStatus: "active", subscriptionEndDate: { lt: new Date() } },
    data: { subscriptionStatus: "inactive" },
  });
  return result.count > 0;
}

export async function expireAllLapsed(): Promise<{ expiredCount: number }> {
  const result = await prisma.merchant.updateMany({
    where: { subscriptionStatus: "active", subscriptionEndDate: { lt: new Date() } },
    data: { subscriptionStatus: "inactive" },
  });
  return { expiredCount: result.count };
}
