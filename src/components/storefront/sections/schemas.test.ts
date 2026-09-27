import test from "node:test";
import assert from "node:assert/strict";
import { parseSectionsPayload, safeParseSettings, testimonialsSettingsSchema } from "./schemas";

test("safeParseSettings fills in defaults for missing/empty settings", () => {
  const result = safeParseSettings(testimonialsSettingsSchema, {});
  assert.equal(result.limit, 6);
});

test("safeParseSettings falls back to defaults entirely for malformed settings, rather than crashing", () => {
  // limit must be an int 1-12 — "not a number" should fall back, not throw.
  const result = safeParseSettings(testimonialsSettingsSchema, { limit: "not-a-number" });
  assert.equal(result.limit, 6);
});

test("parseSectionsPayload drops unknown section types instead of rejecting the whole save", () => {
  const result = parseSectionsPayload([
    { type: "stats", enabled: true, settings: {} },
    { type: "not_a_real_section", enabled: true, settings: {} },
    { type: "products", enabled: true, settings: {} },
  ]);
  assert.deepEqual(
    result.map((s) => s.type),
    ["stats", "products"]
  );
});

test("parseSectionsPayload preserves array order and never echoes back a client-supplied position field", () => {
  const result = parseSectionsPayload([
    { type: "newsletter", enabled: true, settings: {} },
    { type: "stats", enabled: true, settings: {}, position: 99 },
  ]);
  assert.equal(result[0].type, "newsletter");
  assert.equal(result[1].type, "stats");
  assert.equal((result[1] as Record<string, unknown>).position, undefined);
});

test("parseSectionsPayload treats enabled as true unless explicitly false", () => {
  const result = parseSectionsPayload([{ type: "stats", settings: {} }, { type: "products", enabled: false, settings: {} }]);
  assert.equal(result[0].enabled, true);
  assert.equal(result[1].enabled, false);
});

test("parseSectionsPayload returns an empty list for non-array input", () => {
  assert.deepEqual(parseSectionsPayload(null), []);
  assert.deepEqual(parseSectionsPayload("not an array"), []);
  assert.deepEqual(parseSectionsPayload(undefined), []);
});
