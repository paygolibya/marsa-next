import test from "node:test";
import assert from "node:assert/strict";
import { handleValidateCoupon, type ValidateCouponDb } from "./handler";
import type { CouponLike } from "@/lib/coupons";

function req(body: unknown) {
  return new Request("http://localhost/api/orders/validate-coupon", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(opts: { store?: { id: string }; coupon?: CouponLike }) {
  const db: ValidateCouponDb = {
    store: { findUnique: async () => opts.store ?? null },
    coupon: { findUnique: async () => opts.coupon ?? null },
  };
  return db;
}

test("rejects malformed input with 400", async () => {
  const db = makeFakeDb({});
  const res = await handleValidateCoupon(db, req({ storeSlug: "store" }));
  assert.equal(res.status, 400);
});

test("returns 404 when the store doesn't exist", async () => {
  const db = makeFakeDb({});
  const res = await handleValidateCoupon(db, req({ storeSlug: "nope", code: "SAVE10", subtotalCents: 10000 }));
  assert.equal(res.status, 404);
});

test("returns invalid (200, not an error) for an unknown coupon code", async () => {
  const db = makeFakeDb({ store: { id: "store-1" } });
  const res = await handleValidateCoupon(db, req({ storeSlug: "s", code: "NOPE", subtotalCents: 10000 }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.valid, false);
});

test("looks up the coupon code uppercased and trimmed, scoped to the resolved store", async () => {
  let receivedWhere: unknown;
  const db: ValidateCouponDb = {
    store: { findUnique: async () => ({ id: "store-1" }) },
    coupon: {
      findUnique: async (args) => {
        receivedWhere = args.where;
        return null;
      },
    },
  };
  await handleValidateCoupon(db, req({ storeSlug: "s", code: "  save10  ", subtotalCents: 10000 }));
  assert.deepEqual(receivedWhere, { storeId_code: { storeId: "store-1", code: "SAVE10" } });
});

test("an active, unexpired, unexhausted coupon returns the real discount from resolveCouponDiscount", async () => {
  const db = makeFakeDb({
    store: { id: "store-1" },
    coupon: { active: true, discountType: "percent", discountValue: 10, minOrderCents: null, maxUsage: null, usageCount: 0, expiresAt: null },
  });
  const res = await handleValidateCoupon(db, req({ storeSlug: "s", code: "SAVE10", subtotalCents: 10000 }));
  const body = await res.json();
  assert.equal(body.valid, true);
  assert.equal(body.discountCents, 1000);
});

test("an inactive coupon is reported invalid with a reason, not silently ignored", async () => {
  const db = makeFakeDb({
    store: { id: "store-1" },
    coupon: { active: false, discountType: "percent", discountValue: 10, minOrderCents: null, maxUsage: null, usageCount: 0, expiresAt: null },
  });
  const res = await handleValidateCoupon(db, req({ storeSlug: "s", code: "SAVE10", subtotalCents: 10000 }));
  const body = await res.json();
  assert.equal(body.valid, false);
  assert.ok(body.message);
});

test("returns a 500 with valid:false, not a thrown error, when something downstream fails", async () => {
  const db: ValidateCouponDb = {
    store: { findUnique: async () => { throw new Error("db down"); } },
    coupon: { findUnique: async () => null },
  };
  const res = await handleValidateCoupon(db, req({ storeSlug: "s", code: "SAVE10", subtotalCents: 10000 }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.valid, false);
});
