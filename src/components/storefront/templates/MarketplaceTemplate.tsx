import Image from "next/image";
import { ProductsSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import type { StorefrontTemplateProps } from "./types";

// "stats" has no entry here — Marketplace shows the social-proof line
// inline in its compact sticky header (see below), not as a movable body
// section, so it isn't part of this template's drag-and-drop order. The
// type still exists in a saved sections list (shared across templates) —
// it's simply a no-op here, same as before this refactor.
const SECTION_COMPONENTS: Partial<Record<SectionType, (props: SectionRenderProps) => React.ReactNode>> = {
  products: ProductsSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "السوق" (Marketplace) — denser than the other three on purpose: a
 * compact single-row header with search built in (not a separate block),
 * a 4-column grid on desktop instead of 3, smaller cards with a rating
 * badge overlaid on the image, and stats shown as inline text rather than
 * pills or a banner — the "browse a lot, fast" feel of a marketplace
 * rather than a boutique storefront.
 */
export default function MarketplaceTemplate({
  store,
  filtered,
  query,
  setQuery,
  stats,
  testimonials,
  cartTotalItems,
  onOpenCart,
  onAddToCart,
  newsletterEmail,
  setNewsletterEmail,
  newsletterState,
  onNewsletterSubmit,
  sections,
}: StorefrontTemplateProps) {
  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f8fafc";
  const accent = store.customization?.accentColor || primary;
  const colors = { primary, secondary, accent };
  // Marketplace shows this inline in the header rather than as a body
  // section (see the SECTION_COMPONENTS comment above), but should still
  // respect the "stats" section's enabled toggle from the editor.
  const statsEnabled = sections.find((s) => s.type === "stats")?.enabled ?? true;

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "marketplace",
    colors,
    store,
    filtered,
    query,
    setQuery,
    stats,
    testimonials,
    onAddToCart,
    newsletterEmail,
    setNewsletterEmail,
    newsletterState,
    onNewsletterSubmit,
  };

  let renderedFirst = false;
  const orderedSections = sections
    .filter((s) => s.enabled)
    .map((s) => {
      const Component = SECTION_COMPONENTS[s.type];
      if (!Component) return null;
      const node = Component({ ...sectionProps, settings: s.settings });
      if (!node) return null;
      const spacing = renderedFirst ? "mt-14" : "";
      renderedFirst = true;
      return (
        <div key={s.id ?? s.type} className={spacing}>
          {node}
        </div>
      );
    });

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white border-b border-harbor/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            {store.customization?.logo && (
              <Image src={store.customization.logo} alt={store.name} width={32} height={32} unoptimized className="h-8 w-8 rounded object-cover" />
            )}
            <span className="font-display font-extrabold text-harbor whitespace-nowrap">{store.name}</span>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في المتجر..."
            className="input flex-1 !py-2"
          />
          <button
            onClick={onOpenCart}
            style={{ backgroundColor: primary }}
            className="relative rounded-lg px-4 py-2 text-white font-bold text-sm shrink-0 hover:opacity-90 transition-opacity"
          >
            السلة
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full px-3 py-1 font-bold text-white" style={{ backgroundColor: accent }}>
            الكل
          </span>
          {statsEnabled && stats && (
            <span className="text-rope">
              {stats.deliveredOrderCount > 0 && `+${stats.deliveredOrderCount} طلب مُسلَّم`}
              {stats.averageRating != null && stats.reviewCount > 0 && ` · ★ ${stats.averageRating.toFixed(1)} (${stats.reviewCount})`}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {store.customization?.tagline && <p className="text-harbor/70 text-sm mb-6">{store.customization.tagline}</p>}
        {orderedSections}
      </main>
    </div>
  );
}
