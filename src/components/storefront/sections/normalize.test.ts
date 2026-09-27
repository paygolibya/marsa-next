import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToSections } from "./normalize";

test("real StoreSection rows win over the legacy fallback, sorted by position", () => {
  const result = normalizeToSections(
    [
      { id: "b", type: "products", position: 1, enabled: true, settings: {} },
      { id: "a", type: "stats", position: 0, enabled: true, settings: {} },
    ],
    { sectionOrder: null, showSocialProof: false, showTestimonials: false, showNewsletter: false }
  );
  assert.deepEqual(
    result.map((s) => s.type),
    ["stats", "products"]
  );
});

test("falls back to synthesizing from legacy fields when there are no real StoreSection rows", () => {
  const result = normalizeToSections([], {
    sectionOrder: ["newsletter", "stats", "products", "testimonials"],
    showSocialProof: true,
    showTestimonials: false,
    showNewsletter: true,
  });
  assert.deepEqual(
    result.map((s) => s.type),
    ["newsletter", "stats", "products", "testimonials"]
  );
  assert.equal(result.find((s) => s.type === "stats")!.enabled, true);
  assert.equal(result.find((s) => s.type === "testimonials")!.enabled, false);
  assert.equal(result.find((s) => s.type === "products")!.enabled, true); // no legacy toggle — always on
});
