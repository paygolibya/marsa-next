import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleResendOtp, type ResendOtpDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/auth/resend-otp", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/auth/resend-otp", { method: "POST" });
}

function makeFakeDeps(merchant: { id: string; phone: string; phoneVerified: boolean; otpSentAt: Date | null } | null, otpSuccess = true) {
  const calls: { update?: unknown } = {};
  const deps: ResendOtpDeps = {
    db: {
      merchant: {
        findUnique: async () => merchant,
        update: async (args) => {
          calls.update = args;
          return {};
        },
      },
    },
    requestOtpPin: async () => ({ success: otpSuccess, pin: "654321" }),
  };
  return { deps, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleResendOtp(deps, noTokenReq());
  assert.equal(res.status, 401);
});

test("returns 404 when the merchant doesn't exist", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleResendOtp(deps, req());
  assert.equal(res.status, 404);
});

test("rejects resending to an already-verified phone with 400", async () => {
  const { deps, calls } = makeFakeDeps({ id: "merchant-1", phone: "0912345678", phoneVerified: true, otpSentAt: null });
  const res = await handleResendOtp(deps, req());
  assert.equal(res.status, 400);
  assert.equal(calls.update, undefined);
});

test("enforces the 60-second cooldown server-side, not just client-side", async () => {
  const { deps, calls } = makeFakeDeps({ id: "merchant-1", phone: "0912345678", phoneVerified: false, otpSentAt: new Date() });
  const res = await handleResendOtp(deps, req());
  assert.equal(res.status, 429);
  assert.equal(calls.update, undefined);
});

test("allows resending once the cooldown has elapsed", async () => {
  const { deps } = makeFakeDeps({ id: "merchant-1", phone: "0912345678", phoneVerified: false, otpSentAt: new Date(Date.now() - 61 * 1000) });
  const res = await handleResendOtp(deps, req());
  assert.equal(res.status, 200);
});

test("resets otpAttempts to 0 on a real resend, so a prior lockout doesn't persist against the new code", async () => {
  const { deps, calls } = makeFakeDeps({ id: "merchant-1", phone: "0912345678", phoneVerified: false, otpSentAt: null });
  await handleResendOtp(deps, req());
  const update = calls.update as { data: { otpAttempts: number } };
  assert.equal(update.data.otpAttempts, 0);
});

test("returns 500 when the SMS provider itself reports failure, even though the new code was still stored", async () => {
  const { deps, calls } = makeFakeDeps({ id: "merchant-1", phone: "0912345678", phoneVerified: false, otpSentAt: null }, false);
  const res = await handleResendOtp(deps, req());
  assert.equal(res.status, 500);
  assert.ok(calls.update, "the new code should still be persisted even if the send itself failed");
});
