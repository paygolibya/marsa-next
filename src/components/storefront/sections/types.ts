import type { Product, Store, StoreStats, StoreTestimonial } from "@/lib/api";

export const SECTION_TYPES = ["stats", "products", "testimonials", "newsletter"] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const SECTION_TYPE_LABELS: Record<SectionType, string> = {
  stats: "شارات الثقة",
  products: "المنتجات",
  testimonials: "آراء العملاء",
  newsletter: "النشرة البريدية",
};

// The shape StoreSection rows take once fetched from the API (or
// synthesized in-memory from legacy sectionOrder/show* fields as a
// fallback — see normalizeToSections()). id is only present for a row
// that's actually been saved — a section just added in the editor and not
// yet saved has none.
export type SectionData = {
  id?: string;
  type: SectionType;
  position: number;
  enabled: boolean;
  settings: unknown;
};

export type TemplateVariant = "modern" | "bold" | "luxury" | "marketplace";

// Colors every section needs, resolved once by the calling template from
// store.customization (with the same fallbacks used everywhere else, e.g.
// CartDrawer) rather than each section reaching into store.customization
// itself.
export type SectionColors = {
  primary: string;
  secondary: string;
  accent: string;
};

// Real data every section might need — a section only reads what's
// relevant to its own type, but all four get the same bag (mirrors
// StorefrontTemplateProps, which already does this for the whole page).
export type SectionRenderProps = {
  variant: TemplateVariant;
  colors: SectionColors;
  settings: unknown;
  store: Store;
  filtered: Product[];
  query: string;
  setQuery: (q: string) => void;
  stats: StoreStats | null;
  testimonials: StoreTestimonial[];
  onAddToCart: (product: Product) => void;
  newsletterEmail: string;
  setNewsletterEmail: (v: string) => void;
  newsletterState: "idle" | "loading" | "done" | "error";
  onNewsletterSubmit: (e: React.FormEvent) => void;
};
