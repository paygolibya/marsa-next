import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import BoldTemplate from "./BoldTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";

function render(customizationOverrides: Parameters<typeof makeTestStore>[0]) {
  const store = makeTestStore(customizationOverrides);
  return renderToStaticMarkup(<BoldTemplate {...baseTemplateProps} store={store} />);
}

// Regression test for the bug where the header-style dropdown had no
// effect on Bold at all (it only ever changed Modern) — asserts the
// centered layout actually produces flex-col, not just that it doesn't crash.
test("headerStyle=centered stacks the logo group in a column; standard keeps it a row", () => {
  const centered = render({ headerStyle: "centered" });
  const standard = render({ headerStyle: "standard" });
  assert.match(centered, /flex items-center gap-2 min-w-0 flex-col/);
  assert.doesNotMatch(standard, /flex items-center gap-2 min-w-0 flex-col/);
});

// Regression test for "the merchant should choose the place of the cart...
// doesn't matter where the logo is placed" — cartPosition must control the
// button independently of headerStyle, in every combination.
test("cartPosition controls the cart button's side independently of headerStyle", () => {
  for (const headerStyle of ["standard", "centered"]) {
    const left = render({ headerStyle, cartPosition: "left" });
    const right = render({ headerStyle, cartPosition: "right" });
    assert.match(left, /absolute top-1\/2 -translate-y-1\/2 left-6/, `cartPosition=left, headerStyle=${headerStyle}`);
    assert.match(right, /absolute top-1\/2 -translate-y-1\/2 right-6/, `cartPosition=right, headerStyle=${headerStyle}`);
  }
});

// Regression test for the cart button overflowing a collapsed header bar
// when the logo uses the zero-height overflow trick and the name is
// hidden — the row must always keep a floor height.
test("the header row always carries a minimum height, regardless of what else is shown", () => {
  const collapsedContent = render({ showLogo: true, showStoreName: false, headerStyle: "standard" });
  const fullContent = render({ showLogo: true, showStoreName: true, headerStyle: "centered" });
  assert.match(collapsedContent, /min-h-14/);
  assert.match(fullContent, /min-h-14/);
});

test("showLogo=false omits the logo image entirely", () => {
  const html = render({ showLogo: false });
  assert.doesNotMatch(html, /<img/);
});

test("heroEnabled=false omits Bold's colored hero block (and the store name/tagline that only live inside it)", () => {
  const withHero = render({ heroEnabled: true });
  const withoutHero = render({ heroEnabled: false });
  assert.match(withHero, /Test tagline/);
  assert.doesNotMatch(withoutHero, /Test tagline/);
});
