import test from "node:test";
import assert from "node:assert/strict";
import { safeEqual } from "./safe-equal";

test("equal strings match", () => {
  assert.equal(safeEqual("secret-key-123", "secret-key-123"), true);
});

test("different strings of the same length don't match", () => {
  assert.equal(safeEqual("secret-key-123", "secret-key-124"), false);
});

test("different lengths don't match (and don't throw)", () => {
  assert.equal(safeEqual("short", "much-longer-value"), false);
});

test("a missing value on either side never matches", () => {
  assert.equal(safeEqual(null, "x"), false);
  assert.equal(safeEqual("x", undefined), false);
  assert.equal(safeEqual("", ""), false);
});

test("handles multi-byte characters by byte length", () => {
  assert.equal(safeEqual("مفتاح", "مفتاح"), true);
  assert.equal(safeEqual("مفتاح", "مفتاج"), false);
});
