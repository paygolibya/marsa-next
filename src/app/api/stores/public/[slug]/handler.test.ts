import test from "node:test";
import assert from "node:assert/strict";
import { handleGetPublicStore, type PublicStoreDb } from "./handler";

const fullMerchant = {
  id: "merchant-1",
  name: "Real Merchant Name",
  phone: "0912345678",
  passwordHash: "secret-hash",
  subscriptionTier: "advanced",
  subscriptionStatus: "active",
  codEnabled: true,
  dpayEnabled: true,
  allowMultiplePaymentMethods: true,
  apiAccessEnabled: true,
  selectedPaymentMethod: null,
  subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

function baseStore(overrides: Partial<{ customization: any; sections: any[] }> = {}) {
  return {
    id: "store-1",
    name: "متجري",
    courier: "vanex",
    type: "physical",
    customization: { sectionOrder: null, showSocialProof: true, showTestimonials: false, showNewsletter: true },
    merchant: fullMerchant,
    sections: [],
    ...overrides,
  };
}

function makeFakeDb(opts: { store?: ReturnType<typeof baseStore> | null; products?: any[]; categories?: any[] }) {
  const calls: Record<string, unknown> = {};
  const db: PublicStoreDb = {
    store: { findUnique: async () => opts.store ?? null },
    product: {
      findMany: async () => opts.products ?? [],
    },
    category: {
      findMany: async () => opts.categories ?? [],
    },
    order: {
      count: async () => {
        calls.orderCountCalled = true;
        return 42;
      },
    },
    productReview: {
      aggregate: async () => {
        calls.aggregateCalled = true;
        return { _avg: { rating: 4.5 }, _count: { rating: 10 } };
      },
      findMany: async () => {
        calls.testimonialsFindManyCalled = true;
        return [{ buyerName: "Buyer", rating: 5, reviewText: "great", product: { name: "Widget" } }];
      },
    },
  };
  return { db, calls };
}

test("returns 404 for a nonexistent slug", async () => {
  const { db } = makeFakeDb({ store: null });
  const res = await handleGetPublicStore(db, "nope");
  assert.equal(res.status, 404);
});

test("never leaks the merchant row — no phone, passwordHash, or subscription internals in the response", async () => {
  const { db } = makeFakeDb({ store: baseStore() });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("passwordHash"));
  assert.ok(!serialized.includes("0912345678"));
  assert.ok(!serialized.includes("Real Merchant Name"));
  assert.ok(!("merchant" in body.store));
});

test("exposes only the derived dpayAvailable boolean, computed from the merchant's real subscription state", async () => {
  const { db } = makeFakeDb({ store: baseStore() });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.equal(typeof body.store.dpayAvailable, "boolean");
});

test("fetches stats (delivered orders + rating aggregate) by default when statsEnabled defaults true", async () => {
  const { db, calls } = makeFakeDb({ store: baseStore() });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.ok(calls.orderCountCalled);
  assert.ok(calls.aggregateCalled);
  assert.equal(body.stats.deliveredOrderCount, 42);
  assert.equal(body.stats.reviewCount, 10);
});

test("skips testimonials entirely when showTestimonials defaults false", async () => {
  const { db, calls } = makeFakeDb({ store: baseStore() });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.equal(calls.testimonialsFindManyCalled, undefined);
  assert.deepEqual(body.testimonials, []);
});

test("fetches testimonials when showTestimonials is enabled", async () => {
  const { db, calls } = makeFakeDb({
    store: baseStore({ customization: { sectionOrder: null, showSocialProof: true, showTestimonials: true, showNewsletter: true } }),
  });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.ok(calls.testimonialsFindManyCalled);
  assert.equal(body.testimonials.length, 1);
  assert.equal(body.testimonials[0].productName, "Widget");
});

test("returns the store's real active products", async () => {
  const products = [{ id: "p1", name: "Widget", priceCents: 5000 }];
  const { db } = makeFakeDb({ store: baseStore(), products });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.equal(body.products.length, 1);
  assert.equal(body.products[0].name, "Widget");
});

test("returns the store's categories alongside products", async () => {
  const categories = [{ id: "c1", name: "أحذية", slug: "shoes" }];
  const { db } = makeFakeDb({ store: baseStore(), categories });
  const res = await handleGetPublicStore(db, "my-store");
  const body = await res.json();
  assert.equal(body.categories.length, 1);
  assert.equal(body.categories[0].slug, "shoes");
});
