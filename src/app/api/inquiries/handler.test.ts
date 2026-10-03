import test from "node:test";
import assert from "node:assert/strict";
import { handleCreateInquiry, type InquiriesDb } from "./handler";

const STORE = { id: "store-1", merchant: { phone: "0900000042" } };
const PRODUCT = { id: "p1" };

function req(body: unknown) {
  return new Request("http://localhost/api/inquiries", { method: "POST", body: JSON.stringify(body) });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    storeSlug: "test-store",
    buyerName: "Buyer",
    buyerPhone: "0911111111",
    message: "هل السيارة متوفرة؟",
    ...overrides,
  };
}

function makeFakeDeps(opts: { store?: typeof STORE | null; product?: typeof PRODUCT | null } = {}) {
  const store = opts.store !== undefined ? opts.store : STORE;
  const product = opts.product !== undefined ? opts.product : PRODUCT;
  const calls: {
    inquiryCreate?: { data: { storeId: string; productId: string | null; buyerName: string; buyerPhone: string; message: string } };
    sms?: { merchantPhone: string; buyerName: string; buyerPhone: string };
  } = {};

  const db: InquiriesDb = {
    store: { findUnique: async () => store },
    product: { findFirst: async () => product },
    inquiry: {
      create: async (args) => {
        calls.inquiryCreate = args;
        return { id: "inquiry-1" };
      },
    },
  };

  const deps = {
    db,
    sendNewInquirySms: async (merchantPhone: string, buyerName: string, buyerPhone: string) => {
      calls.sms = { merchantPhone, buyerName, buyerPhone };
    },
  };

  return { deps, calls };
}

test("rejects a malformed body with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleCreateInquiry(deps, req({ storeSlug: "test-store" }));
  assert.equal(res.status, 400);
});

test("returns 404 when the store doesn't exist", async () => {
  const { deps } = makeFakeDeps({ store: null });
  const res = await handleCreateInquiry(deps, req(baseBody()));
  assert.equal(res.status, 404);
});

test("creates the inquiry and notifies the merchant by SMS", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateInquiry(deps, req(baseBody({ productId: "p1" })));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.id, "inquiry-1");
  assert.equal(calls.inquiryCreate!.data.storeId, "store-1");
  assert.equal(calls.inquiryCreate!.data.productId, "p1");
  assert.equal(calls.inquiryCreate!.data.buyerName, "Buyer");
  assert.ok(calls.sms);
  assert.equal(calls.sms!.merchantPhone, "0900000042");
});

test("a productId that doesn't belong to this store is silently dropped, not rejected", async () => {
  const { deps, calls } = makeFakeDeps({ product: null });
  const res = await handleCreateInquiry(deps, req(baseBody({ productId: "not-real" })));
  assert.equal(res.status, 201);
  assert.equal(calls.inquiryCreate!.data.productId, null);
});

test("no productId at all creates a general inquiry", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateInquiry(deps, req(baseBody()));
  assert.equal(res.status, 201);
  assert.equal(calls.inquiryCreate!.data.productId, null);
});
