import test from "node:test";
import assert from "node:assert/strict";
import { formatLYD } from "./api";

test("formatLYD converts cents to a 2-decimal LYD display string", () => {
  assert.equal(formatLYD(0), "0,00 د.ل");
  assert.equal(formatLYD(10000), "100,00 د.ل");
});

test("formatLYD never drops the fractional part for a non-round amount", () => {
  assert.equal(formatLYD(150050), "1.500,50 د.ل");
});
