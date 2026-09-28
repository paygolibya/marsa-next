import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import LuxuryTemplate from "./LuxuryTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";

function render(customizationOverrides: Parameters<typeof makeTestStore>[0]) {
  const store = makeTestStore(customizationOverrides);
  return renderToStaticMarkup(<LuxuryTemplate {...baseTemplateProps} store={store} />);
}

test("showLogo=false omits the logo image entirely", () => {
  assert.doesNotMatch(render({ showLogo: false }), /<img/);
  assert.match(render({ showLogo: true }), /<img/);
});

test("showStoreName=false omits the store name heading", () => {
  // The logo's alt text is always store.name regardless of this toggle, so
  // check specifically for the <h1> heading, not any occurrence of the name.
  assert.doesNotMatch(render({ showStoreName: false }), /<h1[^>]*>Test Store</);
  assert.match(render({ showStoreName: true }), /<h1[^>]*>Test Store</);
});

test("coverImage renders at the size-tier's height class", () => {
  const small = render({ coverImage: "https://example.com/cover.jpg", coverImageSize: "sm" });
  const large = render({ coverImage: "https://example.com/cover.jpg", coverImageSize: "lg" });
  assert.match(small, /h-28 md:h-36/);
  assert.match(large, /h-64 md:h-96/);
});

test("accentColor (or secondaryColor fallback) drives the gold highlight, not primaryColor", () => {
  // Luxury deliberately inverts the usual roles: primaryColor is the dark
  // canvas, accentColor is the highlight — a regression here would put the
  // wrong color on the store name/border.
  const html = render({ primaryColor: "#111111", accentColor: "#ffcc00", secondaryColor: "#222222" });
  assert.match(html, /color:#ffcc00/);
  assert.doesNotMatch(html, /color:#222222/);
});
