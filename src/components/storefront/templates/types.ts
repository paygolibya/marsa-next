import type { Product, Store, StoreStats, StoreTestimonial } from "@/lib/api";

// Every template gets the exact same real data — only how it's laid out
// differs. A template component owns its whole page (header through
// footer content, not including SiteFooter/CartDrawer which the
// orchestrator in store/[slug]/page.tsx still renders around it) so each
// one can genuinely restructure things (grid density, hero treatment,
// dark vs light canvas), not just recolor the same DOM.
export type StorefrontTemplateProps = {
  slug: string;
  store: Store;
  products: Product[];
  filtered: Product[];
  query: string;
  setQuery: (q: string) => void;
  stats: StoreStats | null;
  testimonials: StoreTestimonial[];
  cartTotalItems: number;
  onOpenCart: () => void;
  onAddToCart: (product: Product) => void;
  newsletterEmail: string;
  setNewsletterEmail: (v: string) => void;
  newsletterState: "idle" | "loading" | "done" | "error";
  onNewsletterSubmit: (e: React.FormEvent) => void;
};

// The set of body sections a merchant can drag into any order from the
// customizer (see ProductCustomizer's "ترتيب الأقسام" panel). "products" is
// always one of them — even though it's the commerce-critical block, real
// storefront builders (Shopify included) let it move relative to banners/
// testimonials/newsletter, so it isn't special-cased as a fixed anchor.
export const SECTION_KEYS = ["stats", "products", "testimonials", "newsletter"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const DEFAULT_SECTION_ORDER: SectionKey[] = ["stats", "products", "testimonials", "newsletter"];

// A saved sectionOrder can predate this feature (undefined), or in theory
// carry stale/unknown values if the known keys ever change later — this
// always returns a complete, valid permutation of SECTION_KEYS so templates
// never have to guard against a missing or malformed section.
export function normalizeSectionOrder(saved: string[] | null | undefined): SectionKey[] {
  const valid = (saved ?? []).filter((key): key is SectionKey => (SECTION_KEYS as readonly string[]).includes(key));
  const deduped = Array.from(new Set(valid));
  const missing = SECTION_KEYS.filter((key) => !deduped.includes(key));
  return [...deduped, ...missing];
}
