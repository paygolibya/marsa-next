import Image from "next/image";
import { StatsSection, ProductsSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import type { StorefrontTemplateProps } from "./types";

const SECTION_COMPONENTS: Record<SectionType, (props: SectionRenderProps) => React.ReactNode> = {
  stats: StatsSection,
  products: ProductsSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "الحديث" (Modern) — the baseline template: clean grid, standard header,
 * no strong visual opinion beyond the merchant's own colors. Extracted
 * as-is from what was previously the only storefront layout — every
 * other template deliberately breaks from this structure, not just its
 * colors.
 */
export default function ModernTemplate({
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
  const secondary = store.customization?.secondaryColor || "#f0f0f0";
  const accent = store.customization?.accentColor || primary;
  const headerCentered = store.customization?.headerStyle === "centered";
  const colors = { primary, secondary, accent };

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "modern",
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

  // Each rendered section carries its own top margin except the first one
  // actually rendered — keeps consistent spacing regardless of order.
  let renderedFirst = false;
  const orderedSections = sections
    .filter((s) => s.enabled)
    .map((s) => {
      const Component = SECTION_COMPONENTS[s.type];
      const node = Component({ ...sectionProps, settings: s.settings });
      if (!node) return null;
      const spacing = renderedFirst ? "mt-16" : "";
      renderedFirst = true;
      return (
        <div key={s.id ?? s.type} className={spacing}>
          {node}
        </div>
      );
    });

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur" style={{ backgroundColor: primary }}>
        <div className={`mx-auto max-w-6xl px-6 py-4 flex items-center gap-4 ${headerCentered ? "flex-col justify-center text-center" : "justify-between"}`}>
          <div className={`flex items-center gap-3 ${headerCentered ? "flex-col" : ""}`}>
            {store.customization?.logo && (
              <Image src={store.customization.logo} alt={store.name} width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />
            )}
            <div>
              <h1 className="font-display text-xl font-extrabold text-white">{store.name}</h1>
              {store.customization?.tagline && <p className="text-sm text-white/80">{store.customization.tagline}</p>}
            </div>
          </div>
          <button onClick={onOpenCart} className="relative rounded-full bg-white/15 px-5 py-2 text-white font-bold text-sm hover:bg-white/25 transition-colors">
            سلة التسوق
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {store.customization?.description && <p className="text-harbor/80 mb-6 max-w-2xl">{store.customization.description}</p>}
        {orderedSections}
      </main>
    </div>
  );
}
