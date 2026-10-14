import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BestSellersSection } from "./BestSellersSection";
import { makeTestStore } from "@/components/storefront/templates/test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionRenderProps } from "./types";

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
  isBestSeller: true,
};

const BASE_PROPS: Omit<SectionRenderProps, "bestSellers" | "settings"> = {
  variant: "modern",
  colors: { primary: "#0066cc", secondary: "#f0f0f0", accent: "#0066cc" },
  store: makeTestStore(),
  filtered: [],
  query: "",
  setQuery: () => {},
  categories: [],
  selectedCategoryId: null,
  setSelectedCategoryId: () => {},
  bundles: [],
  stats: null,
  testimonials: [],
  onAddToCart: () => {},
  onAddBundleToCart: () => {},
  newsletterEmail: "",
  setNewsletterEmail: () => {},
  newsletterState: "idle",
  onNewsletterSubmit: () => {},
};

test("renders nothing when there are no best sellers", () => {
  const html = renderToStaticMarkup(<BestSellersSection {...BASE_PROPS} bestSellers={[]} settings={{}} />);
  assert.equal(html, "");
});

test("renders a best-seller badge on every card", () => {
  const html = renderToStaticMarkup(<BestSellersSection {...BASE_PROPS} bestSellers={[PRODUCT]} settings={{}} />);
  assert.match(html, /الأكثر مبيعًا/);
  assert.match(html, new RegExp(PRODUCT.name));
});

test("renders products in the exact order given (the pinned-then-auto-ranked merge already happened server-side)", () => {
  const second: Product = { ...PRODUCT, id: "p2", name: "لوحة مفاتيح ميكانيكية" };
  const html = renderToStaticMarkup(<BestSellersSection {...BASE_PROPS} bestSellers={[second, PRODUCT]} settings={{}} />);
  assert.ok(html.indexOf(second.name) < html.indexOf(PRODUCT.name));
});

test("a product with variant options gets a choose-options link instead of an add-to-cart button", () => {
  const withVariants: Product = { ...PRODUCT, variantOptions: [{ name: "اللون", values: ["أحمر", "أزرق"] }] };
  const html = renderToStaticMarkup(<BestSellersSection {...BASE_PROPS} bestSellers={[withVariants]} settings={{}} />);
  assert.match(html, /اختر الخيارات/);
});

test("respects a custom section title from settings", () => {
  const html = renderToStaticMarkup(<BestSellersSection {...BASE_PROPS} bestSellers={[PRODUCT]} settings={{ title: "عنوان مخصص" }} />);
  assert.match(html, /عنوان مخصص/);
});
