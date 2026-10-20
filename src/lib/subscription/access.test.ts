import test from "node:test";
import assert from "node:assert/strict";
import { isSubscriptionLive } from "./access";

const now = new Date("2026-11-14T12:00:00Z");

test("live while active and the period hasn't ended", () => {
  assert.equal(isSubscriptionLive({ subscriptionStatus: "active", subscriptionEndDate: "2026-11-15T00:00:00Z" }, now), true);
});

test("locked the moment the trial/period end passes, even before the nightly cron flips the status", () => {
  assert.equal(isSubscriptionLive({ subscriptionStatus: "active", subscriptionEndDate: "2026-11-14T11:59:00Z" }, now), false);
});

test("locked when inactive, pending, suspended or rejected", () => {
  for (const s of ["inactive", "pending", "suspended", "rejected"]) {
    assert.equal(isSubscriptionLive({ subscriptionStatus: s, subscriptionEndDate: "2027-01-01T00:00:00Z" }, now), false, s);
  }
});

test("an active merchant with no end date is non-expiring", () => {
  assert.equal(isSubscriptionLive({ subscriptionStatus: "active", subscriptionEndDate: null }, now), true);
});
