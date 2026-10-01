import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug";

test("a plain Latin name becomes a simple hyphenated slug", () => {
  assert.equal(slugify("My Cool Shop"), "my-cool-shop");
});

test("an Arabic name is kept as-is (slugs intentionally allow Arabic)", () => {
  assert.equal(slugify("متجر رائع"), "متجر-رائع");
});

// The actual bug found live: a real merchant's store name "Nova filters 💕"
// produced the slug "nova-filters-" — a trailing hyphen as the last
// character of what becomes a {slug}.rifqa.ly subdomain label.
test("a name ending in an emoji doesn't leave a trailing hyphen", () => {
  assert.equal(slugify("Nova filters 💕"), "nova-filters");
});

test("a name starting with an emoji doesn't leave a leading hyphen", () => {
  assert.equal(slugify("💕 Nova filters"), "nova-filters");
});

test("an emoji in the middle of a name collapses to a single hyphen, not a double one", () => {
  assert.equal(slugify("Nova 💕 filters"), "nova-filters");
});

test("a name that's entirely stripped characters produces an empty slug (caller falls back to a random id)", () => {
  assert.equal(slugify("💕💕💕"), "");
});

test("still truncates to 60 characters, and trims a trailing hyphen newly exposed by that cut", () => {
  const longName = "a".repeat(59) + "-" + "b".repeat(10);
  const result = slugify(longName);
  assert.ok(result.length <= 60);
  assert.ok(!result.endsWith("-"), `expected no trailing hyphen, got: ${result}`);
});
