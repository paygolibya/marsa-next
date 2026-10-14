import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import PlayfulTemplate from "./PlayfulTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "لعبة دمية",
  description: null,
  categoryId: null,
  priceCents: 4500,
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
    <PlayfulTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders bubbly rounded-[2rem] cards, not the flat rounded-2xl other templates use", () => {
  const html = render();
  assert.match(html, /rounded-\[2rem\]/);
});

test("the hero uses a gradient background, not a flat color fill", () => {
  const html = render();
  assert.match(html, /linear-gradient/);
});

test("the hero falls back to playful-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<PlayfulTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /كل ما يحتاجه أحباؤك الصغار/);
});

test("heroEnabled=false hides the hero band entirely", () => {
  const store = makeTestStore({ heroEnabled: false });
  const html = renderToStaticMarkup(<PlayfulTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /كل ما يحتاجه أحباؤك الصغار/);
});
