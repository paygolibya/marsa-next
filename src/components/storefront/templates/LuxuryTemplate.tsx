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
 * "الفاخر" (Luxury) — the one template that inverts the usual primary/
 * secondary roles on purpose: primaryColor is the dark canvas itself
 * (default #1f2937), secondaryColor/accentColor is the gold highlight
 * (default #f59e0b) — that's what actually reads as "luxury," not a
 * light page with a dark header. Centered nav, generous whitespace, a
 * refined 2-column grid instead of 3, thin gold-on-dark borders.
 */
export default function LuxuryTemplate({
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
  const dark = store.customization?.primaryColor || "#1f2937";
  const gold = store.customization?.accentColor || store.customization?.secondaryColor || "#f59e0b";
  // Luxury inverts the usual roles — "primary" here is the dark canvas
  // (background), not a button/header color, and "accent" (gold) does the
  // highlighting work primary normally does elsewhere. Each section's
  // variant="luxury" branch already knows this and reads colors.primary/
  // accent accordingly.
  const colors = { primary: dark, secondary: dark, accent: gold };

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "luxury",
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
      const node = Component({ ...sectionProps, settings: s.settings });
      if (!node) return null;
      const spacing = renderedFirst ? "mt-24" : "";
      renderedFirst = true;
      return (
        <div key={s.id ?? s.type} className={spacing}>
          {node}
        </div>
      );
    });

  return (
    <div style={{ backgroundColor: dark }} className="min-h-screen text-white">
      <header className="border-b" style={{ borderColor: `${gold}30` }}>
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center text-center gap-3">
          {store.customization?.logo && (
            <Image src={store.customization.logo} alt={store.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover" style={{ border: `1px solid ${gold}` }} />
          )}
          <h1 className="font-display text-3xl font-extrabold tracking-wide" style={{ color: gold }}>
            {store.name}
          </h1>
          {store.customization?.tagline && <p className="text-white/60 text-sm tracking-wide">{store.customization.tagline}</p>}
          <button
            onClick={onOpenCart}
            className="relative mt-2 rounded-full border px-6 py-2 text-sm font-bold tracking-wide hover:bg-white/5 transition-colors"
            style={{ borderColor: gold, color: gold }}
          >
            سلة التسوق
            {cartTotalItems > 0 && (
              <span
                className="absolute -top-2 -left-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ backgroundColor: gold, color: dark }}
              >
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {store.customization?.description && <p className="text-white/70 text-center max-w-xl mx-auto mb-10">{store.customization.description}</p>}
        {orderedSections}
      </main>
    </div>
  );
}
