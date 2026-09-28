import test from "node:test";
import assert from "node:assert/strict";
import { handleRegister, type RegisterDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, ip?: string) {
  const headers = new Headers();
  if (ip) headers.set("x-forwarded-for", ip);
  return new Request("http://localhost/api/auth/register", { method: "POST", headers, body: JSON.stringify(body) });
}

const validBody = { name: "Test Merchant", phone: "0912345678", password: "password123" };

function makeFakeDeps(opts: { existingPhone?: string; recentCountByIp?: number; otpSuccess?: boolean } = {}) {
  const calls: Record<string, unknown> = {};
  const deps: RegisterDeps = {
    db: {
      merchant: {
        findUnique: async (args) => {
          calls.findUnique = args;
          return opts.existingPhone === args.where.phone ? { id: "existing-merchant" } : null;
        },
        count: async (args) => {
          calls.count = args;
          return opts.recentCountByIp ?? 0;
        },
        create: async (args) => {
          calls.create = args;
          return {
            id: "new-merchant-1",
            name: (args.data as any).name,
            phone: (args.data as any).phone,
            subscriptionTier: (args.data as any).subscriptionTier,
            subscriptionStatus: (args.data as any).subscriptionStatus,
            phoneVerified: false,
          };
        },
      },
    },
    requestOtpPin: async () => ({ success: opts.otpSuccess ?? true, pin: "123456" }),
  };
  return { deps, calls };
}

test("rejects invalid input (bad phone format) with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleRegister(deps, req({ ...validBody, phone: "not-a-phone" }));
  assert.equal(res.status, 400);
});

test("rejects a duplicate phone with 409", async () => {
  const { deps, calls } = makeFakeDeps({ existingPhone: "0912345678" });
  const res = await handleRegister(deps, req(validBody));
  assert.equal(res.status, 409);
  assert.equal(calls.create, undefined);
});

test("rate-limits registration at 3 per IP per hour, returning 429 before hashing/sending anything", async () => {
  const { deps, calls } = makeFakeDeps({ recentCountByIp: 3 });
  const res = await handleRegister(deps, req(validBody, "203.0.113.5"));
  assert.equal(res.status, 429);
  assert.equal(calls.create, undefined);
});

test("allows registration under the per-IP limit", async () => {
  const { deps } = makeFakeDeps({ recentCountByIp: 2 });
  const res = await handleRegister(deps, req(validBody, "203.0.113.5"));
  assert.equal(res.status, 201);
});

test("creates a merchant on a 90-day trial with the full-featured tier, not a payment-review-pending state", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleRegister(deps, req(validBody));
  assert.equal(res.status, 201);
  const create = calls.create as { data: { subscriptionStatus: string; subscriptionTier: string; trialEndsAt: Date; subscriptionEndDate: Date } };
  assert.equal(create.data.subscriptionStatus, "active");
  assert.equal(create.data.subscriptionTier, "advanced");
  const daysGranted = (create.data.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(daysGranted > 85 && daysGranted < 91, `expected ~90 days, got ${daysGranted.toFixed(1)}`);
});

test("stores a hash of the OTP pin, never the plaintext code, and returns a signed token", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleRegister(deps, req(validBody));
  const body = await res.json();
  assert.ok(body.token);
  const create = calls.create as { data: { otpCodeHash: string } };
  assert.notEqual(create.data.otpCodeHash, "123456");
  assert.ok(create.data.otpCodeHash.length > 20, "expected a real bcrypt hash, not the raw pin");
});

test("surfaces otpSendFailed:true when the SMS provider reports failure, but still creates the account", async () => {
  const { deps } = makeFakeDeps({ otpSuccess: false });
  const res = await handleRegister(deps, req(validBody));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.otpSendFailed, true);
});

test("never hits the rate-limit count query when no client IP is resolvable", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleRegister(deps, req(validBody)); // no x-forwarded-for
  assert.equal(res.status, 201);
  assert.equal(calls.count, undefined);
});
