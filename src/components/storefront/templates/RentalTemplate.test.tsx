import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import RentalTemplate from "./RentalTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "خيمة تخييم",
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
};

const PRODUCTS_SECTION: SectionData = { id: "s1", type: "products", position: 0, enabled: true, settings: {} };

function render() {
  const store = { ...makeTestStore(), type: "rental" as const };
  return renderToStaticMarkup(
    <RentalTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders the rental CTA, never the generic add-to-cart one", () => {
  const html = render();
  assert.match(html, /استأجر الآن/);
  assert.doesNotMatch(html, /أضف إلى السلة/);
});

test("shows the daily-rate suffix on the price", () => {
  assert.match(render(), / \/ يوم/);
});

test("the header cart button is labeled for rental, not a generic cart", () => {
  assert.match(render(), /عناصري/);
});

test("the hero falls back to rental-specific copy when the store has no custom tagline", () => {
  const store = { ...makeTestStore(), type: "rental" as const };
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<RentalTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /استأجر بدلاً من الشراء/);
});
