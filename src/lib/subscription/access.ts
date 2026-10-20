// Whether a merchant's store may serve shoppers and take orders. A store
// is locked the moment its trial or paid period ends, until the merchant
// pays — before this only the dashboard was gated (via expireIfLapsed /
// the expire cron); the storefront stayed live and kept taking orders, so
// an unpaid merchant lost nothing and had no reason to subscribe.
//
// Checked on the end date directly (not only subscriptionStatus), so the
// lock applies immediately at expiry rather than waiting for the nightly
// expire-subscriptions cron to flip the status. An active merchant with no
// end date is treated as non-expiring (one legacy account), never locked.
export function isSubscriptionLive(
  merchant: { subscriptionStatus?: string | null; subscriptionEndDate?: Date | string | null } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!merchant || merchant.subscriptionStatus !== "active") return false;
  if (!merchant.subscriptionEndDate) return true;
  return new Date(merchant.subscriptionEndDate).getTime() > now.getTime();
}

// HTTP status the public store + order endpoints return for a locked
// store, so storefront pages can tell "paused" apart from "not found".
export const STORE_LOCKED_STATUS = 423;
