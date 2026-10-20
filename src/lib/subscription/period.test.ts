import test from "node:test";
import assert from "node:assert/strict";
import { paidPeriodEnd } from "./period";

const now = new Date("2026-11-04T10:00:00Z");

test("paying before the trial ends stacks the paid month on top of the remaining days", () => {
  const trialEnd = new Date("2026-11-14T10:00:00Z");
  assert.equal(paidPeriodEnd(trialEnd, 1, now).toISOString(), "2026-12-14T10:00:00.000Z");
});

test("a lapsed merchant's paid period starts today", () => {
  const lapsed = new Date("2026-10-01T10:00:00Z");
  assert.equal(paidPeriodEnd(lapsed, 3, now).toISOString(), "2027-02-04T10:00:00.000Z");
  assert.equal(paidPeriodEnd(null, 1, now).toISOString(), "2026-12-04T10:00:00.000Z");
});
