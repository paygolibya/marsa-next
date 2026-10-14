import test from "node:test";
import assert from "node:assert/strict";
import { rankBestSellers } from "./best-sellers";

type P = { id: string; isBestSeller: boolean };

test("pinned products always come first, regardless of sales", () => {
  const products: P[] = [
    { id: "p1", isBestSeller: false },
    { id: "p2", isBestSeller: true },
  ];
  const result = rankBestSellers(products, [{ productId: "p1", quantity: 100 }], 10);
  assert.deepEqual(result.map((p) => p.id), ["p2", "p1"]);
});

test("auto-ranked products are sorted by units sold descending", () => {
  const products: P[] = [
    { id: "p1", isBestSeller: false },
    { id: "p2", isBestSeller: false },
    { id: "p3", isBestSeller: false },
  ];
  const soldCounts = [
    { productId: "p1", quantity: 5 },
    { productId: "p2", quantity: 50 },
    { productId: "p3", quantity: 20 },
  ];
  const result = rankBestSellers(products, soldCounts, 10);
  assert.deepEqual(result.map((p) => p.id), ["p2", "p3", "p1"]);
});

test("a pinned product never appears twice even if it also has real sales", () => {
  const products: P[] = [{ id: "p1", isBestSeller: true }];
  const result = rankBestSellers(products, [{ productId: "p1", quantity: 999 }], 10);
  assert.equal(result.length, 1);
});

test("caps the combined list at the limit, pinned taking priority", () => {
  const products: P[] = [
    { id: "p1", isBestSeller: true },
    { id: "p2", isBestSeller: true },
    { id: "p3", isBestSeller: false },
  ];
  const result = rankBestSellers(products, [{ productId: "p3", quantity: 10 }], 1);
  assert.deepEqual(result.map((p) => p.id), ["p1"]);
});

test("a sold-count row for a product not in the active catalog (deleted/inactive) is silently skipped", () => {
  const products: P[] = [{ id: "p1", isBestSeller: false }];
  const result = rankBestSellers(products, [{ productId: "ghost", quantity: 500 }], 10);
  assert.deepEqual(result, []);
});

test("returns an empty array when there are no pinned products and no sales", () => {
  const products: P[] = [{ id: "p1", isBestSeller: false }];
  assert.deepEqual(rankBestSellers(products, [], 10), []);
});
