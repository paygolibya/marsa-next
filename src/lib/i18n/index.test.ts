import test from "node:test";
import assert from "node:assert/strict";
import ar from "./ar.json";
import en from "./en.json";
import { translate, dirForLanguage, isSupportedLanguage } from "./index";

test("translates a plain key with no placeholders", () => {
  assert.equal(translate("ar", "cart.title"), "سلة التسوق");
  assert.equal(translate("en", "cart.title"), "Shopping Cart");
});

test("substitutes {placeholder} tokens with the given vars", () => {
  assert.equal(translate("en", "bundles.savings", { amount: "10 LYD" }), "Save 10 LYD when you buy this bundle together");
  assert.equal(translate("ar", "bundles.savings", { amount: "10 د.ل" }), "وفّر 10 د.ل عند شراء هذه الباقة مجمّعة");
});

test("leaves unmatched placeholders untouched", () => {
  assert.equal(translate("en", "bundles.itemsCount"), "{count} products in one bundle");
});

test("falls back to the Arabic dictionary for a key missing from another language", () => {
  const key = "__fixture_only_in_ar__";
  (ar as Record<string, string>)[key] = "نص تجريبي";
  assert.equal(translate("en", key), "نص تجريبي");
  delete (ar as Record<string, string>)[key];
});

test("falls back to the raw key when it exists in neither dictionary", () => {
  assert.equal(translate("en", "__totally_missing_key__"), "__totally_missing_key__");
});

test("dirForLanguage maps ar to rtl and everything else to ltr", () => {
  assert.equal(dirForLanguage("ar"), "rtl");
  assert.equal(dirForLanguage("en"), "ltr");
});

test("isSupportedLanguage accepts only ar/en", () => {
  assert.equal(isSupportedLanguage("ar"), true);
  assert.equal(isSupportedLanguage("en"), true);
  assert.equal(isSupportedLanguage("fr"), false);
});

test("every key in the Arabic dictionary has a matching key in the English dictionary", () => {
  const arKeys = Object.keys(ar).sort();
  const enKeys = Object.keys(en).sort();
  const missingFromEn = arKeys.filter((k) => !enKeys.includes(k));
  const missingFromAr = enKeys.filter((k) => !arKeys.includes(k));
  assert.deepEqual(missingFromEn, [], `keys missing from en.json: ${missingFromEn.join(", ")}`);
  assert.deepEqual(missingFromAr, [], `keys missing from ar.json: ${missingFromAr.join(", ")}`);
});
