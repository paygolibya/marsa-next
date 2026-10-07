import test from "node:test";
import assert from "node:assert/strict";
import { handleGetPayConfig, type PayConfigDb } from "./handler";

process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
process.env.MOAMALAT_SECRET_KEY = "abcd1234";

function makeFakeDb(
  order: { id: string; totalCents: number; shippingCents: number; paymentMethod: string; paymentStatus: string; store: { slug: string } } | null
) {
  const db: PayConfigDb = { order: { findUnique: async () => order } };
  return db;
}

test("returns 404 for a nonexistent order", async () => {
  const db = makeFakeDb(null);
  const res = await handleGetPayConfig(db, "nope");
  assert.equal(res.status, 404);
});

test("rejects a COD order with 400 — nothing to pay via Moamalat", async () => {
  const db = makeFakeDb({ id: "order-1", totalCents: 5000, shippingCents: 0, paymentMethod: "cod", paymentStatus: "pending", store: { slug: "my-store" } });
  const res = await handleGetPayConfig(db, "order-1");
  assert.equal(res.status, 400);
});

test("rejects an already-paid order with 400", async () => {
  const db = makeFakeDb({ id: "order-1", totalCents: 5000, shippingCents: 0, paymentMethod: "wallet", paymentStatus: "paid", store: { slug: "my-store" } });
  const res = await handleGetPayConfig(db, "order-1");
  assert.equal(res.status, 400);
});

test("returns a real signed LightBox config + the store's slug/shipping for a pending wallet order", async () => {
  const db = makeFakeDb({ id: "order-1", totalCents: 12345, shippingCents: 1500, paymentMethod: "wallet", paymentStatus: "pending", store: { slug: "my-store" } });
  const res = await handleGetPayConfig(db, "order-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.storeSlug, "my-store");
  assert.equal(body.totalCents, 12345);
  assert.equal(body.shippingCents, 1500);
  assert.equal(body.moamalat.MID, "TESTMID");
  assert.equal(body.moamalat.TID, "TESTTID");
  assert.equal(body.moamalat.AmountTrxn, 123450); // *10, Moamalat's smallest-subunit convention
  assert.equal(body.moamalat.MerchantReference, "order:order-1");
  assert.match(body.moamalat.SecureHash, /^[0-9A-F]{64}$/);
  assert.ok(body.moamalatScriptUrl.includes("moamalat.net"));
});

test("returns 503 when Moamalat isn't configured at all", async () => {
  const realMid = process.env.MOAMALAT_MERCHANT_ID;
  delete process.env.MOAMALAT_MERCHANT_ID;
  try {
    const db = makeFakeDb({ id: "order-1", totalCents: 5000, shippingCents: 0, paymentMethod: "wallet", paymentStatus: "pending", store: { slug: "my-store" } });
    const res = await handleGetPayConfig(db, "order-1");
    assert.equal(res.status, 503);
  } finally {
    process.env.MOAMALAT_MERCHANT_ID = realMid;
  }
});
