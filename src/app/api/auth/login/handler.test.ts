import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleLogin, type LoginDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

const MERCHANT = {
  id: "merchant-1",
  name: "Test Merchant",
  phone: "0911111111",
  passwordHash: "hashed-password",
  subscriptionTier: "advanced",
  subscriptionStatus: "active",
  phoneVerified: true,
  subscriptionEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
  trialEndsAt: null,
};

function req(body: unknown, ip: string | null = "203.0.113.5") {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: ip ? { "x-forwarded-for": ip } : undefined,
    body: JSON.stringify(body),
  });
}

function makeFakeDeps(opts: { merchant?: typeof MERCHANT | null; passwordMatches?: boolean; expired?: boolean; recentFailures?: number } = {}) {
  const merchant = opts.merchant !== undefined ? opts.merchant : MERCHANT;
  const calls: { compareArgs?: [string, string]; expireArgs?: string; loginAttemptCreated?: string[]; countArgs?: unknown } = { loginAttemptCreated: [] };
  const deps: LoginDeps = {
    db: {
      merchant: { findUnique: async () => merchant },
      loginAttempt: {
        count: async (args) => {
          calls.countArgs = args;
          return opts.recentFailures ?? 0;
        },
        create: async (args) => {
          calls.loginAttemptCreated!.push(args.data.ip);
          return {};
        },
      },
    },
    expireIfLapsed: async (id) => {
      calls.expireArgs = id;
      return opts.expired ?? false;
    },
    comparePassword: (password, hash) => {
      calls.compareArgs = [password, hash];
      return opts.passwordMatches ?? true;
    },
  };
  return { deps, calls };
}

test("rejects a malformed body (missing phone/password) with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleLogin(deps, req({ phone: "0911111111" })); // no password
  assert.equal(res.status, 400);
});

test("rejects an unknown phone number with 401 — never leaking whether the phone exists", async () => {
  const { deps } = makeFakeDeps({ merchant: null });
  const res = await handleLogin(deps, req({ phone: "0900000000", password: "whatever" }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "Invalid phone or password"); // same generic message either way
});

test("rejects a wrong password with 401, using the same generic message as an unknown phone", async () => {
  const { deps, calls } = makeFakeDeps({ passwordMatches: false });
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "wrong" }));
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, "Invalid phone or password");
  assert.deepEqual(calls.compareArgs, ["wrong", "hashed-password"]); // password compared against THIS merchant's own hash
});

test("a correct login returns a real, verifiable JWT for the correct merchant id", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  const payload = jwt.verify(body.token, process.env.JWT_SECRET!) as { merchantId: string };
  assert.equal(payload.merchantId, "merchant-1");
  assert.equal(body.merchant.phone, "0911111111");
  assert.equal(body.merchant.passwordHash, undefined, "the password hash must never be returned to the client");
});

test("expireIfLapsed is checked on every login, keyed to the authenticated merchant", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  assert.equal(calls.expireArgs, "merchant-1");
});

test("a lapsed subscription is reflected in the response immediately, without needing a second request", async () => {
  const { deps } = makeFakeDeps({ expired: true });
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  const body = await res.json();
  assert.equal(body.merchant.subscriptionStatus, "inactive");
});

test("when the subscription hasn't lapsed, the merchant's real subscriptionStatus passes through unchanged", async () => {
  const { deps } = makeFakeDeps({ merchant: { ...MERCHANT, subscriptionStatus: "active" }, expired: false });
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  const body = await res.json();
  assert.equal(body.merchant.subscriptionStatus, "active");
});

// --- rate limiting: the actual point of this session's fix ---

test("a wrong password is logged as a failed attempt against the caller's IP", async () => {
  const { deps, calls } = makeFakeDeps({ passwordMatches: false });
  await handleLogin(deps, req({ phone: "0911111111", password: "wrong" }, "198.51.100.9"));
  assert.deepEqual(calls.loginAttemptCreated, ["198.51.100.9"]);
});

test("a CORRECT login never logs a failed attempt", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  assert.deepEqual(calls.loginAttemptCreated, []);
});

test("once an IP has enough recent failures, further attempts are rejected with 429 BEFORE checking the password", async () => {
  const { deps, calls } = makeFakeDeps({ recentFailures: 10, passwordMatches: true });
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  assert.equal(res.status, 429);
  assert.equal(calls.compareArgs, undefined, "must short-circuit before ever comparing the password");
});

test("a request with no IP header at all is never rate-limited (nothing to key the counter on) and still processes normally", async () => {
  const { deps } = makeFakeDeps({ recentFailures: 999 });
  const res = await handleLogin(deps, req({ phone: "0911111111", password: "correct" }, null));
  assert.equal(res.status, 200);
});

test("the failure-count check is scoped to a recent time window, not all-time", async () => {
  const { deps, calls } = makeFakeDeps({ recentFailures: 3 });
  await handleLogin(deps, req({ phone: "0911111111", password: "correct" }));
  const args = calls.countArgs as { where: { createdAt: { gte: Date } } };
  const windowMinutes = (Date.now() - args.where.createdAt.gte.getTime()) / 60000;
  assert.ok(windowMinutes > 0 && windowMinutes <= 15.1, `expected a ~15 minute window, got ${windowMinutes.toFixed(1)}m`);
});
