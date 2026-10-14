import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import TechTemplate from "./TechTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "سماعات لاسلكية",
  description: null,
  categoryId: null,
  priceCents: 45000,
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
    <TechTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("product cards use the dark bg-harbor treatment, distinct from the light page around them", () => {
  const html = render();
  assert.match(html, /bg-harbor/);
});

test("the hero is a self-contained dark band (accent background), not the whole page", () => {
  const store = makeTestStore();
  const html = renderToStaticMarkup(
    <TechTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />
  );
  // The page's own outer wrapper uses the store's (light, per the fixture)
  // secondaryColor; the hero band separately sets the dark `accent`
  // default as its own backgroundColor — confirms the whole page is NOT
  // dark, only the hero.
  assert.match(html, /background-color:#f0f0f0/i, "page wrapper must stay on the fixture's light secondaryColor");
  assert.match(html, /background-color:#0f172a/i, "hero band must use the dark accent default");
});

test("the hero falls back to tech-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<TechTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /أحدث التقنيات بين يديك/);
});

test("heroEnabled=false hides the hero band entirely", () => {
  const store = makeTestStore({ heroEnabled: false });
  const html = renderToStaticMarkup(<TechTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /أحدث التقنيات بين يديك/);
});
