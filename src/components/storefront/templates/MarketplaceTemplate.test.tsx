import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import MarketplaceTemplate from "./MarketplaceTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { StorefrontTemplateProps } from "./types";

function render(
  customizationOverrides: Parameters<typeof makeTestStore>[0],
  propOverrides: Partial<Pick<StorefrontTemplateProps, "stats" | "sections">> = {}
) {
  const store = makeTestStore(customizationOverrides);
  return renderToStaticMarkup(<MarketplaceTemplate {...baseTemplateProps} {...propOverrides} store={store} />);
}

test("showLogo=false omits the logo image entirely", () => {
  assert.doesNotMatch(render({ showLogo: false }), /<img/);
});

test("textSize controls both the heading class and the tagline body class", () => {
  const large = render({ textSize: "lg", tagline: "hello" });
  const small = render({ textSize: "sm", tagline: "hello" });
  assert.match(large, /text-xl/); // heading
  assert.match(large, /text-base/); // body/tagline
  assert.match(small, /text-base/); // heading (sm)
  assert.match(small, /text-xs/); // body/tagline
});

test("the stats line respects the 'stats' section's own enabled toggle", () => {
  const stats = { deliveredOrderCount: 42, averageRating: 4.5, reviewCount: 10 };
  const enabled = render({}, { stats, sections: [{ id: "s1", type: "stats", position: 0, enabled: true, settings: {} }] });
  const disabled = render({}, { stats, sections: [{ id: "s1", type: "stats", position: 0, enabled: false, settings: {} }] });
  assert.match(enabled, /42 طلب مُسلَّم/);
  assert.doesNotMatch(disabled, /42 طلب مُسلَّم/);
});

test("logo uses rounded-lg (not the circular default) to preserve Marketplace's own look", () => {
  const html = render({ logoSize: "md" });
  assert.match(html, /rounded-lg/);
});
