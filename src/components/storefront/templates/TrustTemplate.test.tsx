import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import TrustTemplate from "./TrustTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product, StoreStats } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "معقم يدين",
  description: null,
  categoryId: null,
  priceCents: 2500,
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
const STATS_SECTION: SectionData = { id: "s2", type: "stats", position: 1, enabled: true, settings: {} };

test("the hero trust strip only renders real delivered/rating data, never fabricated claims", () => {
  const store = makeTestStore();
  const stats: StoreStats = { deliveredOrderCount: 120, averageRating: 4.7, reviewCount: 30 };
  const html = renderToStaticMarkup(
    <TrustTemplate {...baseTemplateProps} store={store} stats={stats} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
  assert.match(html, /120/);
  assert.match(html, /4\.7/);
  assert.doesNotMatch(html, /مضمون|معتمد رسميًا|شهادة/, "must never show unverifiable certification-style claims");
});

test("the stats section is never rendered twice (hero strip + body section)", () => {
  const store = makeTestStore();
  const stats: StoreStats = { deliveredOrderCount: 120, averageRating: 4.7, reviewCount: 30 };
  const html = renderToStaticMarkup(
    <TrustTemplate {...baseTemplateProps} store={store} stats={stats} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION, STATS_SECTION]} />
  );
  const occurrences = html.split("120").length - 1;
  assert.equal(occurrences, 1, `expected the delivered count to appear exactly once, found ${occurrences}`);
});

test("with no stats at all, the hero shows no trust strip, just the heading", () => {
  const store = makeTestStore();
  const html = renderToStaticMarkup(<TrustTemplate {...baseTemplateProps} store={store} stats={null} products={[]} filtered={[]} sections={[]} />);
  assert.doesNotMatch(html, /rounded-lg bg-white px-4 py-2/);
});

test("the hero falls back to trust-specific copy when the store has no custom tagline", () => {
  const store = makeTestStore();
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<TrustTemplate {...baseTemplateProps} store={store} stats={null} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /منتجات موثوقة لصحتك وراحتك/);
});
