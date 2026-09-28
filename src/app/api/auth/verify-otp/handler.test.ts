import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { handleVerifyOtp, type VerifyOtpDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(code: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/auth/verify-otp", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify({ code }),
  });
}

function noTokenReq(code: unknown) {
  return new Request("http://localhost/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ code }) });
}

const REAL_CODE = "123456";
const REAL_HASH = bcrypt.hashSync(REAL_CODE, 4);

function baseMerchant(overrides: Partial<{
  phoneVerified: boolean;
  otpAttempts: number;
  otpCodeHash: string | null;
  otpExpiresAt: Date | null;
}> = {}) {
  return {
    id: "merchant-1",
    name: "Test",
    phone: "0912345678",
    subscriptionTier: "basic",
    subscriptionStatus: "active",
    phoneVerified: false,
    otpAttempts: 0,
    otpCodeHash: REAL_HASH,
    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    ...overrides,
  };
}

function makeFakeDb(merchant: ReturnType<typeof baseMerchant> | null) {
  const calls: { update?: unknown } = {};
  let current = merchant;
  const db: VerifyOtpDb = {
    merchant: {
      findUnique: async () => current,
      update: async (args) => {
        calls.update = args;
        const { otpAttempts, ...rest } = args.data as any;
        current = { ...(current as any), ...rest };
        if (otpAttempts?.increment) {
          current!.otpAttempts += otpAttempts.increment;
        } else if (typeof otpAttempts === "number") {
          current!.otpAttempts = otpAttempts;
        }
        return current as any;
      },
    },
  };
  return { db, calls, get current() { return current; } };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb(baseMerchant());
  const res = await handleVerifyOtp(db, noTokenReq(REAL_CODE));
  assert.equal(res.status, 401);
});

test("rejects a missing code with 400", async () => {
  const { db } = makeFakeDb(baseMerchant());
  const res = await handleVerifyOtp(db, req(undefined));
  assert.equal(res.status, 400);
});

test("returns 404 when the merchant doesn't exist", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleVerifyOtp(db, req(REAL_CODE));
  assert.equal(res.status, 404);
});

test("an already-verified merchant gets a 200 with their info, not re-checked against the code", async () => {
  const { db } = makeFakeDb(baseMerchant({ phoneVerified: true }));
  const res = await handleVerifyOtp(db, req("wrong-code-entirely"));
  assert.equal(res.status, 200);
});

test("locks out at MAX_ATTEMPTS (5) with 429, before even checking the expiry/hash", async () => {
  const { db, calls } = makeFakeDb(baseMerchant({ otpAttempts: 5 }));
  const res = await handleVerifyOtp(db, req(REAL_CODE));
  assert.equal(res.status, 429);
  assert.equal(calls.update, undefined);
});

test("rejects an expired code with 400", async () => {
  const { db } = makeFakeDb(baseMerchant({ otpExpiresAt: new Date(Date.now() - 1000) }));
  const res = await handleVerifyOtp(db, req(REAL_CODE));
  assert.equal(res.status, 400);
});

test("a wrong code increments otpAttempts and returns 400, without verifying", async () => {
  const { db, calls } = makeFakeDb(baseMerchant());
  const res = await handleVerifyOtp(db, req("000000"));
  assert.equal(res.status, 400);
  assert.deepEqual((calls.update as any).data, { otpAttempts: { increment: 1 } });
});

test("the correct code marks the merchant verified and clears the OTP state (can't be replayed)", async () => {
  const { db, calls } = makeFakeDb(baseMerchant());
  const res = await handleVerifyOtp(db, req(REAL_CODE));
  assert.equal(res.status, 200);
  const update = calls.update as { data: { phoneVerified: boolean; otpCodeHash: null; otpAttempts: number } };
  assert.equal(update.data.phoneVerified, true);
  assert.equal(update.data.otpCodeHash, null);
  assert.equal(update.data.otpAttempts, 0);
});

test("five consecutive wrong attempts locks the account out on the next try", async () => {
  const { db } = makeFakeDb(baseMerchant());
  for (let i = 0; i < 5; i++) {
    const res = await handleVerifyOtp(db, req("wrong"));
    assert.equal(res.status, 400);
  }
  const lockedRes = await handleVerifyOtp(db, req(REAL_CODE)); // correct code, but too late
  assert.equal(lockedRes.status, 429);
});
