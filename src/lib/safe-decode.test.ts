import test from "node:test";
import assert from "node:assert/strict";
import { safeDecode } from "./safe-decode";
import { createOrderSchema } from "./validation";

test("decodes a percent-encoded Arabic slug", () => {
  assert.equal(safeDecode("%D8%B9"), "ع");
  assert.equal(safeDecode("%D9%85%D8%AA%D8%AC%D8%B1-%D9%83%D9%84-%D8%B4%D9%8A"), "متجر-كل-شي");
});

test("leaves already-decoded and ASCII slugs unchanged", () => {
  assert.equal(safeDecode("ع"), "ع");
  assert.equal(safeDecode("alhayes-fashion"), "alhayes-fashion");
});

test("keeps an invalid escape sequence as-is instead of throwing", () => {
  assert.equal(safeDecode("100%"), "100%");
});

// Regression: storefronts sent useParams()'s still-encoded slug, so every
// Arabic-named store's orders 404'd. The schema now normalizes it.
test("order validation decodes an encoded storeSlug", () => {
  const parsed = createOrderSchema.safeParse({
    storeSlug: "%D8%B9",
    items: [{ productId: "p1", quantity: 1 }],
    buyer: { name: "Buyer", phone: "0911111111", city: "بنغازي", address: "street", email: "" },
    paymentMethod: "cod",
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.storeSlug, "ع");
});
