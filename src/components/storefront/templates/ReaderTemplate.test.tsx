import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ReaderTemplate from "./ReaderTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "رواية عربية",
  description: null,
  categoryId: null,
  priceCents: 3500,
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
    <ReaderTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders book-cover portrait imagery (aspect-[2/3]), not a square grid", () => {
  const html = render();
  assert.match(html, /aspect-\[2\/3\]/);
  assert.doesNotMatch(html, /aspect-square/);
});

test("uses an understated underline CTA, never a filled add-to-cart button", () => {
  const html = render();
  assert.match(html, /أضف إلى السلة/);
  assert.doesNotMatch(html, /rounded-xl text-white py-3/);
  assert.doesNotMatch(html, /rounded-full text-white py-2/);
});

test("the hero falls back to reader-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<ReaderTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /عالم من الكتب بين يديك/);
});

test("heroEnabled=false hides the hero band entirely", () => {
  const store = makeTestStore({ heroEnabled: false });
  const html = renderToStaticMarkup(<ReaderTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /عالم من الكتب بين يديك/);
});
