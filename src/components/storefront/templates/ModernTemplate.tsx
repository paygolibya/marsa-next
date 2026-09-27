import Image from "next/image";
import { StatsSection, ProductsSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { StorefrontLogo } from "./StorefrontLogo";
import { resolveCoverImageHeightClass, resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

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
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const colors = { primary, secondary, accent, text: textColor };

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
            {showLogo && store.customization?.logo && (headerCentered ? (
              // The overflow-past-the-bar trick (StorefrontLogo) only
              // works when the logo is a row sibling — in centered mode
              // it's stacked in a flex-COLUMN, where height genuinely
              // matters for layout, so a plain sized image is used here
              // instead (a bigger logo grows the header in this mode).
              <Image src={store.customization.logo} alt={store.name} width={logoPx} height={logoPx} unoptimized className="rounded-full object-cover" style={{ width: logoPx, height: logoPx }} />
            ) : (
              <StorefrontLogo src={store.customization.logo} alt={store.name} sizePx={logoPx} />
            ))}
            {(showStoreName || store.customization?.tagline) && (
              <div>
                {showStoreName && <h1 className={`font-display font-extrabold text-white ${textSize.heading}`}>{store.name}</h1>}
                {store.customization?.tagline && <p className={`text-white/80 ${textSize.body}`}>{store.customization.tagline}</p>}
              </div>
            )}
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

      {store.customization?.coverImage && (
        <div className={`w-full overflow-hidden ${resolveCoverImageHeightClass(store.customization?.coverImageSize)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={store.customization.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">
        {store.customization?.description && <p className={`text-harbor/80 mb-6 max-w-2xl ${textSize.body}`} style={{ color: colors.text }}>{store.customization.description}</p>}
        {orderedSections}
      </main>
    </div>
  );
}
