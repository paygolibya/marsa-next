import test from "node:test";
import assert from "node:assert/strict";
import { handleListReviews, handleCreateReview, type ProductReviewsDb, type ProductReviewsDeps } from "./handler";

function req(body: unknown) {
  return new Request("http://localhost/api/products/product-1/reviews", { method: "POST", body: JSON.stringify(body) });
}

const validBody = { orderId: "order-1", phone: "0912345678", buyerName: "Buyer", rating: 5, reviewText: "great" };

function makeFakeDb(reviews: { id: string; productId: string; buyerName: string; rating: number; reviewText: string | null; createdAt: Date }[] = []) {
  const calls: { create?: unknown } = {};
  const db: ProductReviewsDb = {
    productReview: {
      findMany: async () => reviews,
      create: async (args) => {
        calls.create = args;
        return { id: "review-1", productId: args.data.productId, buyerName: args.data.buyerName, rating: args.data.rating, reviewText: args.data.reviewText, createdAt: new Date() };
      },
    },
  };
  return { db, calls };
}

test("GET returns an empty list with average 0, not an error, when a product has no reviews", async () => {
  const { db } = makeFakeDb([]);
  const res = await handleListReviews(db, "product-1");
  const body = await res.json();
  assert.deepEqual(body, { reviews: [], average: 0, count: 0 });
});

test("GET computes the real average rating and never includes buyerPhone", async () => {
  const reviews = [
    { id: "r1", productId: "product-1", buyerName: "A", rating: 5, reviewText: null, createdAt: new Date() },
    { id: "r2", productId: "product-1", buyerName: "B", rating: 3, reviewText: null, createdAt: new Date() },
  ];
  const { db } = makeFakeDb(reviews);
  const res = await handleListReviews(db, "product-1");
  const body = await res.json();
  assert.equal(body.average, 4);
  assert.equal(body.count, 2);
  assert.ok(!("buyerPhone" in body.reviews[0]));
});

test("POST rejects invalid input (rating out of range) with 400", async () => {
  const { db } = makeFakeDb();
  const deps: ProductReviewsDeps = { db, verifyBuyerOrder: async () => ({ items: [{ productId: "product-1" }] }) };
  const res = await handleCreateReview(deps, req({ ...validBody, rating: 6 }), "product-1");
  assert.equal(res.status, 400);
});

test("POST rejects a non-matching order-id/phone pair with 404, before checking product membership", async () => {
  const { db } = makeFakeDb();
  const deps: ProductReviewsDeps = { db, verifyBuyerOrder: async () => null };
  const res = await handleCreateReview(deps, req(validBody), "product-1");
  assert.equal(res.status, 404);
});

test("POST rejects a real order that never contained this product with 400 — can't review something you didn't buy", async () => {
  const { db, calls } = makeFakeDb();
  const deps: ProductReviewsDeps = { db, verifyBuyerOrder: async () => ({ items: [{ productId: "some-other-product" }] }) };
  const res = await handleCreateReview(deps, req(validBody), "product-1");
  assert.equal(res.status, 400);
  assert.equal(calls.create, undefined);
});

test("POST creates a review for a verified purchase and never echoes buyerPhone back", async () => {
  const { db, calls } = makeFakeDb();
  const deps: ProductReviewsDeps = { db, verifyBuyerOrder: async () => ({ items: [{ productId: "product-1" }] }) };
  const res = await handleCreateReview(deps, req(validBody), "product-1");
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(!("buyerPhone" in body));
  assert.equal((calls.create as any).data.buyerPhone, "0912345678"); // stored, just never returned
});

test("POST maps a unique-constraint violation (already reviewed this purchase) to a friendly 409, not a 500", async () => {
  const db: ProductReviewsDb = {
    productReview: {
      findMany: async () => [],
      create: async () => {
        const err = new Error("duplicate") as Error & { code: string };
        err.code = "P2002";
        throw err;
      },
    },
  };
  const deps: ProductReviewsDeps = { db, verifyBuyerOrder: async () => ({ items: [{ productId: "product-1" }] }) };
  const res = await handleCreateReview(deps, req(validBody), "product-1");
  assert.equal(res.status, 409);
});
