import test from "node:test";
import assert from "node:assert/strict";
import { isAdminMerchantId } from "./auth";

process.env.JWT_SECRET ||= "test-secret";

test("returns false for a null/undefined merchantId without ever querying the database", async () => {
  assert.equal(await isAdminMerchantId(null), false);
  assert.equal(await isAdminMerchantId(undefined), false);
});

test("grants admin via ADMIN_MERCHANT_IDS without needing a database lookup", async () => {
  process.env.ADMIN_MERCHANT_IDS = "merchant-1,merchant-2";
  assert.equal(await isAdminMerchantId("merchant-1"), true);
  assert.equal(await isAdminMerchantId("merchant-2"), true);
  delete process.env.ADMIN_MERCHANT_IDS;
});

// Note: the phone-lookup path (an id not in ADMIN_MERCHANT_IDS falls
// through to a real prisma.merchant.findUnique to check its phone against
// ADMIN_MERCHANT_PHONES) isn't covered here — isAdminMerchantId imports
// the real prisma client directly rather than taking it as a dependency,
// so exercising that branch needs a real database, not a unit test. The
// fix itself (removing the hardcoded "0910000000" fallback from that
// phones list — see auth.ts's own comment) was verified by reading the
// code directly, the same way this bug was originally found.

test("trims whitespace and supports both singular/plural env var names", async () => {
  process.env.ADMIN_MERCHANT_ID = " merchant-solo ";
  assert.equal(await isAdminMerchantId("merchant-solo"), true);
  delete process.env.ADMIN_MERCHANT_ID;
});
