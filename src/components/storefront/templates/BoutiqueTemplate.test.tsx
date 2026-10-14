import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import BoutiqueTemplate from "./BoutiqueTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "فستان صيفي",
  description: null,
  categoryId: null,
  priceCents: 15000,
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
  isBestSeller: false,
};

const PRODUCTS_SECTION: SectionData = { id: "s1", type: "products", position: 0, enabled: true, settings: {} };

function render() {
  const store = makeTestStore();
  return renderToStaticMarkup(
    <BoutiqueTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders portrait 3:4 product imagery, not the dense square grid other templates use", () => {
  const html = render();
  assert.match(html, /aspect-\[3\/4\]/);
  assert.doesNotMatch(html, /aspect-square/);
});

test("uses an understated underline CTA, never a filled add-to-cart button", () => {
  const html = render();
  assert.match(html, /أضف إلى السلة/);
  assert.doesNotMatch(html, /rounded-xl text-white py-3/);
  assert.doesNotMatch(html, /rounded-full text-white py-2/);
});

test("the hero falls back to boutique-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<BoutiqueTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /مجموعة مختارة بعناية/);
});

test("heroEnabled=false hides the hero band entirely", () => {
  const store = makeTestStore({ heroEnabled: false });
  const html = renderToStaticMarkup(<BoutiqueTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /مجموعة مختارة بعناية/);
});
