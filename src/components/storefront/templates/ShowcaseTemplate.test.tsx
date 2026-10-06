import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import ShowcaseTemplate from "./ShowcaseTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "لوحة فنية",
  description: null,
  categoryId: null,
  priceCents: 50000,
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
  const store = { ...makeTestStore(), type: "showcase" as const };
  return renderToStaticMarkup(
    <ShowcaseTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders the inquire CTA, never add-to-cart or a price", () => {
  const html = render();
  assert.match(html, /استفسر/);
  assert.doesNotMatch(html, /أضف إلى السلة/);
  assert.doesNotMatch(html, /50,000.00/); // formatLYD of 50000 cents — showcase never prices a product
});

test("has no cart button at all in the header", () => {
  // The marketplace/modern/booking/rental headers all render a cartTotalItems
  // badge wrapper even at 0 — showcase's header renders no cart button node
  // whatsoever, so this span never appears.
  assert.doesNotMatch(render(), /rounded-full bg-signal text-\[11px\]/);
});

test("the hero falls back to showcase-specific copy when the store has no custom tagline", () => {
  const store = { ...makeTestStore(), type: "showcase" as const };
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<ShowcaseTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /استعرض مجموعتنا/);
});
