import test from "node:test";
import assert from "node:assert/strict";
import { isAdminMerchant } from "./is-admin";

test("returns false for a null/undefined merchant", () => {
  assert.equal(isAdminMerchant(null), false);
  assert.equal(isAdminMerchant(undefined), false);
});

test("returns false when NEXT_PUBLIC_ADMIN_MERCHANT_PHONES is unset, even for the old hardcoded admin phone", () => {
  // Regression test for a real fix: this fallback used to be hardcoded to
  // "0910000000" in source — a public string that granted admin to
  // whoever self-registered with that exact phone first. Unset must now
  // mean "no one is admin," not "fall back to a known value."
  delete process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES;
  assert.equal(isAdminMerchant({ phone: "0910000000" }), false);
});

test("returns true only for a phone actually listed in the env var", () => {
  process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES = "0911111111,0922222222";
  assert.equal(isAdminMerchant({ phone: "0911111111" }), true);
  assert.equal(isAdminMerchant({ phone: "0933333333" }), false);
  delete process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES;
});

test("trims whitespace around comma-separated phones", () => {
  process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES = " 0911111111 , 0922222222 ";
  assert.equal(isAdminMerchant({ phone: "0922222222" }), true);
  delete process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES;
});
