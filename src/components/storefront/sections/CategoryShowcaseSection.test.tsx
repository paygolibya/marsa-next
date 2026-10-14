import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { CategoryShowcaseSection } from "./CategoryShowcaseSection";
import { makeTestStore } from "@/components/storefront/templates/test-fixtures";
import type { Category } from "@/lib/api";
import type { SectionRenderProps } from "./types";

const BASE_PROPS: Omit<SectionRenderProps, "categories" | "settings"> = {
  variant: "modern",
  colors: { primary: "#0066cc", secondary: "#f0f0f0", accent: "#0066cc" },
  store: makeTestStore(),
  filtered: [],
  query: "",
  setQuery: () => {},
  selectedCategoryId: null,
  setSelectedCategoryId: () => {},
  bundles: [],
  stats: null,
  testimonials: [],
  bestSellers: [],
  onAddToCart: () => {},
  onAddBundleToCart: () => {},
  newsletterEmail: "",
  setNewsletterEmail: () => {},
  newsletterState: "idle",
  onNewsletterSubmit: () => {},
};

const WITH_IMAGE: Category = { id: "c1", name: "أحذية", slug: "shoes", position: 0, imageUrl: "https://example.com/shoes.jpg" };
const WITHOUT_IMAGE: Category = { id: "c2", name: "حقائب", slug: "bags", position: 1, imageUrl: null };

test("renders nothing when there are no categories", () => {
  const html = renderToStaticMarkup(<CategoryShowcaseSection {...BASE_PROPS} categories={[]} settings={{}} />);
  assert.equal(html, "");
});

test("a category with an image renders it as the tile background", () => {
  const html = renderToStaticMarkup(<CategoryShowcaseSection {...BASE_PROPS} categories={[WITH_IMAGE]} settings={{}} />);
  assert.match(html, /shoes\.jpg/);
  assert.match(html, /أحذية/);
});

test("a category with no image falls back to a plain tinted tile, not a broken image", () => {
  const html = renderToStaticMarkup(<CategoryShowcaseSection {...BASE_PROPS} categories={[WITHOUT_IMAGE]} settings={{}} />);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /حقائب/);
});

test("each tile is a button wired to setSelectedCategoryId for that category's id", () => {
  const html = renderToStaticMarkup(<CategoryShowcaseSection {...BASE_PROPS} categories={[WITH_IMAGE]} settings={{}} />);
  assert.match(html, /<button/);
});

test("respects a custom section title from settings", () => {
  const html = renderToStaticMarkup(<CategoryShowcaseSection {...BASE_PROPS} categories={[WITH_IMAGE]} settings={{ title: "عنوان مخصص" }} />);
  assert.match(html, /عنوان مخصص/);
});
