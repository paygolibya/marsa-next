import test from "node:test";
import assert from "node:assert/strict";
import { validateCustomizationEnums } from "./validate";

test("valid values on the allow-list pass through unchanged", () => {
  const result = validateCustomizationEnums({
    logoSize: "xl",
    textSize: "lg",
    coverImageSize: "sm",
    heroSize: "md",
    cartPosition: "right",
  });
  assert.deepEqual(result, {
    validLogoSize: "xl",
    validTextSize: "lg",
    validCoverImageSize: "sm",
    validHeroSize: "md",
    validCartPosition: "right",
  });
});

test("an unknown value becomes undefined instead of being persisted as-is", () => {
  const result = validateCustomizationEnums({
    logoSize: "huge",
    textSize: "xl", // valid for logoSize, not for textSize
    coverImageSize: "",
    heroSize: 123,
    cartPosition: "center",
  });
  assert.equal(result.validLogoSize, undefined);
  assert.equal(result.validTextSize, undefined);
  assert.equal(result.validCoverImageSize, undefined);
  assert.equal(result.validHeroSize, undefined);
  assert.equal(result.validCartPosition, undefined);
});

test("missing fields become undefined rather than throwing", () => {
  const result = validateCustomizationEnums({});
  assert.equal(result.validLogoSize, undefined);
  assert.equal(result.validCartPosition, undefined);
});
