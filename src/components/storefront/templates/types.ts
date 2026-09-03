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
