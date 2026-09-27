import type { Product, Store, StoreStats, StoreTestimonial } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

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
  // The store's real StoreSection rows (or the legacy-synthesized
  // fallback — see normalizeToSections()), already resolved by the
  // caller. Templates just render them in order; they no longer compute
  // section order themselves from store.customization.
  sections: SectionData[];
};

// The set of body sections a merchant can drag into any order from the
// customizer (see ProductCustomizer's "ترتيب الأقسام" panel). "products" is
// always one of them — even though it's the commerce-critical block, real
// storefront builders (Shopify included) let it move relative to banners/
// testimonials/newsletter, so it isn't special-cased as a fixed anchor.
export const SECTION_KEYS = ["stats", "products", "testimonials", "newsletter"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const DEFAULT_SECTION_ORDER: SectionKey[] = ["stats", "products", "testimonials", "newsletter"];

// Shared across all 4 templates so a merchant's chosen logo size looks the
// same regardless of which template they're on, rather than each template
// keeping its own hardcoded logo width/height. "xl" deliberately exceeds
// any header bar's own height — see <StorefrontLogo>, which renders it
// absolutely positioned so a big logo overflows the bar instead of
// stretching it.
export const LOGO_SIZE_PX: Record<string, number> = { sm: 32, md: 48, lg: 64, xl: 96 };
export function resolveLogoSizePx(logoSize: string | undefined): number {
  return LOGO_SIZE_PX[logoSize ?? "md"] ?? LOGO_SIZE_PX.md;
}

// Shared 3-tier "sm/md/lg" scale reused by text size, cover-image height,
// and hero padding — one place to keep the actual pixel/class values so
// they can't drift apart between templates.
export const TEXT_SIZE_CLASS: Record<string, { heading: string; body: string }> = {
  sm: { heading: "text-lg", body: "text-xs" },
  md: { heading: "text-xl", body: "text-sm" },
  lg: { heading: "text-2xl", body: "text-base" },
};
export function resolveTextSizeClass(textSize: string | undefined) {
  return TEXT_SIZE_CLASS[textSize ?? "md"] ?? TEXT_SIZE_CLASS.md;
}

export const COVER_IMAGE_HEIGHT_CLASS: Record<string, string> = {
  sm: "h-28 md:h-36",
  md: "h-48 md:h-64",
  lg: "h-64 md:h-96",
};
export function resolveCoverImageHeightClass(coverImageSize: string | undefined): string {
  return COVER_IMAGE_HEIGHT_CLASS[coverImageSize ?? "md"] ?? COVER_IMAGE_HEIGHT_CLASS.md;
}

// BoldTemplate's hero block vertical padding.
export const HERO_PADDING_CLASS: Record<string, string> = {
  sm: "py-8",
  md: "py-16",
  lg: "py-24",
};
export function resolveHeroPaddingClass(heroSize: string | undefined): string {
  return HERO_PADDING_CLASS[heroSize ?? "md"] ?? HERO_PADDING_CLASS.md;
}

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
