import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveLogoSizePx,
  resolveTextSizeClass,
  resolveCoverImageHeightClass,
  resolveHeroPaddingClass,
  normalizeSectionOrder,
  SECTION_KEYS,
} from "./types";

test("size resolvers fall back to their 'md' tier for an unset or unknown value", () => {
  assert.equal(resolveLogoSizePx(undefined), resolveLogoSizePx("md"));
  assert.equal(resolveLogoSizePx("not-a-real-size"), resolveLogoSizePx("md"));
  assert.equal(resolveTextSizeClass(undefined).heading, resolveTextSizeClass("md").heading);
  assert.equal(resolveCoverImageHeightClass("bogus"), resolveCoverImageHeightClass("md"));
  assert.equal(resolveHeroPaddingClass("bogus"), resolveHeroPaddingClass("md"));
});

test("resolveLogoSizePx is monotonically increasing across its known tiers", () => {
  const sm = resolveLogoSizePx("sm");
  const md = resolveLogoSizePx("md");
  const lg = resolveLogoSizePx("lg");
  const xl = resolveLogoSizePx("xl");
  assert.ok(sm < md && md < lg && lg < xl, `expected sm < md < lg < xl, got ${sm} < ${md} < ${lg} < ${xl}`);
});

test("normalizeSectionOrder returns every known section key exactly once", () => {
  const result = normalizeSectionOrder(["products", "products", "stats"]);
  assert.deepEqual(new Set(result), new Set(SECTION_KEYS));
  assert.equal(result.length, SECTION_KEYS.length);
});

test("normalizeSectionOrder drops unrecognized keys and fills in any missing ones at the end", () => {
  const result = normalizeSectionOrder(["newsletter", "not_a_real_section", "stats"]);
  assert.equal(result[0], "newsletter");
  assert.equal(result[1], "stats");
  assert.ok(result.includes("products"));
  assert.ok(result.includes("testimonials"));
  assert.equal(result.includes("not_a_real_section" as never), false);
});

test("normalizeSectionOrder returns the default order for null/undefined input", () => {
  assert.deepEqual(normalizeSectionOrder(null), [...SECTION_KEYS]);
  assert.deepEqual(normalizeSectionOrder(undefined), [...SECTION_KEYS]);
});
