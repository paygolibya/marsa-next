import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import SportTemplate from "./SportTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "حذاء جري",
  description: null,
  categoryId: null,
  priceCents: 25000,
  imageUrl: null,
  images: [],
  variantOptions: null,
  variants: [],
  active: true,
  createdAt: new Date().toISOString(),
  trackInventory: false,
  stockQty: 0,
  lowStockThreshold: 0,
  metaTitle: null,
  metaDescription: null,
  costPriceCents: null,
};

const PRODUCTS_SECTION: SectionData = { id: "s1", type: "products", position: 0, enabled: true, settings: {} };

function render() {
  const store = makeTestStore();
  return renderToStaticMarkup(
    <SportTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("product cards use a diagonal clip-path cut, not a plain rounded rectangle", () => {
  const html = render();
  assert.match(html, /clip-path:polygon/);
  assert.doesNotMatch(html, /rounded-3xl/);
});

test("the hero band itself uses the same diagonal clip-path language", () => {
  const html = render();
  const matches = html.match(/clip-path:polygon/g) ?? [];
  assert.ok(matches.length >= 2, "expected the clip-path cut on both the hero band and the product card");
});

test("CTA buttons use the skewed uppercase treatment, not Bold's chunky shadow style", () => {
  const html = render();
  assert.match(html, /-skew-x-6/);
  assert.doesNotMatch(html, /shadow-lg hover:opacity-90/);
});

test("the hero falls back to sport-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<SportTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /جهّز نفسك للتحدي/);
});

test("heroEnabled=false hides the hero band entirely", () => {
  const store = makeTestStore({ heroEnabled: false });
  const html = renderToStaticMarkup(<SportTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /جهّز نفسك للتحدي/);
});
