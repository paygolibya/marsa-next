import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { handleMoamalatComplete, type MoamalatCompleteDeps } from "./handler";

const SECRET = crypto.randomBytes(16).toString("hex");
process.env.MOAMALAT_SECRET_KEY = SECRET;

function req(body: unknown) {
  return new Request("http://localhost/api/payments/moamalat/complete", { method: "POST", body: JSON.stringify(body) });
}

// Same HMAC recipe as moamalat-client.ts's own (private) computeSecureHash
// — sort field names ascending, join "name=value" with "&", HMAC-SHA256
// with the hex-decoded secret, uppercase hex.
function signFields(fields: Record<string, string>): string {
  const message = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  return crypto.createHmac("sha256", Buffer.from(SECRET, "hex")).update(message, "utf8").digest("hex").toUpperCase();
}

// Mirrors handler.ts's own field-collection logic exactly (MerchantReference
// + every non-empty string field + SystemReference/NetworkReference) and
// signs over the FINAL field set including any overrides — for building a
// callback that is legitimately valid but varies some fields (a different
// MerchantReference, missing optional references, etc).
function makeValidCallback(overrides: Record<string, unknown> = {}) {
  const base = {
    MerchantReference: "order:order-1",
    TxnDate: "20260101",
    Amount: "100000",
    Currency: "434",
    SystemReference: "SYS-1",
    NetworkReference: "NET-1",
    ...overrides,
  };
  const fieldsToHash: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === "string" && v.length > 0) fieldsToHash[k] = v;
  }
  const SecureHash = signFields(fieldsToHash);
  return { ...base, SecureHash };
}

// Signs the field set, then changes one field on the OUTGOING body
// afterward without re-signing — a genuinely tampered callback, unlike
// makeValidCallback's overrides (which are part of what gets signed).
function makeTamperedCallback(tamperedField: Record<string, unknown>) {
  const valid = makeValidCallback();
  return { ...valid, ...tamperedField };
}

function makeFakeDeps(finalizeResult: Awaited<ReturnType<MoamalatCompleteDeps["finalizeByMerchantReference"]>> = null) {
  const calls: { orderUpdate?: unknown; paymentUpdate?: unknown; finalizeArgs?: unknown } = {};
  const deps: MoamalatCompleteDeps = {
    db: {
      order: {
        update: async (args) => {
          calls.orderUpdate = args;
          return {};
        },
      },
      payment: {
        update: async (args) => {
          calls.paymentUpdate = args;
          return {};
        },
      },
    },
    finalizeByMerchantReference: async (ref, outcome) => {
      calls.finalizeArgs = { ref, outcome };
      return finalizeResult;
    },
  };
  return { deps, calls };
}

test("rejects invalid JSON with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleMoamalatComplete(deps, new Request("http://localhost/x", { method: "POST", body: "not json" }));
  assert.equal(res.status, 400);
});

test("rejects a payload missing MerchantReference with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleMoamalatComplete(deps, req({ Amount: "100" }));
  assert.equal(res.status, 400);
});

test("rejects a tampered SecureHash with 401 — this IS the security boundary a forged client callback would need to beat", async () => {
  const { deps, calls } = makeFakeDeps();
  const callback = makeTamperedCallback({ Amount: "1" }); // changed after signing
  const res = await handleMoamalatComplete(deps, req(callback));
  assert.equal(res.status, 401);
  assert.equal(calls.finalizeArgs, undefined, "must never finalize a payment on an unverified callback");
});

test("a valid order-payment callback finalizes as 'paid' and records both Moamalat references on the order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "order", id: "order-1", result: { trackingId: "TRACK-1", courier: "vanex" } });
  const res = await handleMoamalatComplete(deps, req(makeValidCallback()));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "paid");
  assert.equal(body.kind, "order");
  assert.equal(body.trackingId, "TRACK-1");
  assert.deepEqual(calls.finalizeArgs, { ref: "order:order-1", outcome: "paid" });
  const orderUpdate = calls.orderUpdate as { where: { id: string }; data: { moamalatSystemReference: string; moamalatNetworkReference: string } };
  assert.equal(orderUpdate.where.id, "order-1");
  assert.equal(orderUpdate.data.moamalatSystemReference, "SYS-1");
  assert.equal(calls.paymentUpdate, undefined);
});

test("a valid subscription-payment callback updates the Payment row, not an Order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "subscription", id: "payment-1", result: {} });
  const callback = makeValidCallback({ MerchantReference: "sub:payment-1" });
  const res = await handleMoamalatComplete(deps, req(callback));
  const body = await res.json();
  assert.equal(body.kind, "subscription");
  const paymentUpdate = calls.paymentUpdate as { where: { id: string } };
  assert.equal(paymentUpdate.where.id, "payment-1");
  assert.equal(calls.orderUpdate, undefined);
});

test("an unknown/stale MerchantReference returns 404, not a silent success", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleMoamalatComplete(deps, req(makeValidCallback()));
  assert.equal(res.status, 404);
});

test("skips the Moamalat-reference DB update when SystemReference wasn't provided, without erroring", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "order", id: "order-1", result: {} });
  const callback = makeValidCallback({ SystemReference: undefined, NetworkReference: undefined });
  const res = await handleMoamalatComplete(deps, req(callback));
  assert.equal(res.status, 200);
  assert.equal(calls.orderUpdate, undefined);
});
