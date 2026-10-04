import { StatsSection, ProductsSection, CategoriesSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import {
  resolveCoverImageHeightClass,
  resolveHeroPaddingClass,
  resolveLogoSizePx,
  resolveTextSizeClass,
  type StorefrontTemplateProps,
} from "./types";

const SECTION_COMPONENTS: Record<SectionType, (props: SectionRenderProps) => React.ReactNode> = {
  stats: StatsSection,
  products: ProductsSection,
  categories: CategoriesSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "المميز" (Bold) — a real structural departure from Modern, not a
 * recolor: a full-bleed hero with oversized type instead of a slim header
 * bar, a stats banner instead of subtle pills, taller product images with
 * a hover-zoom, and a chunky shadowed CTA style throughout.
 */
export default function BoldTemplate({
  store,
  filtered,
  query,
  setQuery,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
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
  const primary = store.customization?.primaryColor || "#ef4444";
  const secondary = store.customization?.secondaryColor || "#fef2f2";
  const accent = store.customization?.accentColor || primary;
  const headerCentered = store.customization?.headerStyle === "centered";
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const heroEnabled = store.customization?.heroEnabled !== false;
  const cartOnRight = store.customization?.cartPosition === "right";
  const colors = { primary, secondary, accent, text: textColor };

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "bold",
    colors,
    store,
    filtered,
    query,
    setQuery,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
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
      const spacing = renderedFirst ? "mt-20" : "";
      renderedFirst = true;
      return (
        <div key={s.id ?? s.type} className={spacing}>
          {node}
        </div>
      );
    });

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      {/* Slim utility bar — logo + cart only, the hero below carries the weight */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-harbor/5">
        <StorefrontHeaderRow
          headerCentered={headerCentered}
          showLogo={showLogo}
          logo={store.customization?.logo}
          storeName={store.name}
          logoPx={logoPx}
          cartOnRight={cartOnRight}
          identityExtra={
            showStoreName && (
              <span className={`block min-w-0 truncate font-display font-extrabold text-harbor ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )
          }
          cartButton={
            store.type === "showcase" ? null : (
              <button
                onClick={onOpenCart}
                style={{ backgroundColor: primary }}
                className="relative rounded-xl px-5 py-2 text-white font-extrabold text-sm shadow-lg hover:opacity-90 transition-opacity"
              >
                🛒 السلة
                {cartTotalItems > 0 && (
                  <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-harbor text-[11px] font-bold flex items-center justify-center text-white">
                    {cartTotalItems}
                  </span>
                )}
              </button>
            )
          }
        />
      </div>

      {store.customization?.coverImage && (
        <div className={`w-full overflow-hidden ${resolveCoverImageHeightClass(store.customization?.coverImageSize)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={store.customization.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Full-bleed hero — the only template with this concept, so its
          own on/off + size controls (unlike the shared header/cover ones). */}
      {heroEnabled && (
        <div style={{ backgroundColor: primary }} className={`text-white text-center px-6 ${resolveHeroPaddingClass(store.customization?.heroSize)}`}>
          <h1 className="font-display text-4xl md:text-6xl font-extrabold mb-3 leading-tight">{store.name}</h1>
          {store.customization?.tagline && <p className="text-lg md:text-xl opacity-90 max-w-xl mx-auto">{store.customization.tagline}</p>}
          {store.customization?.description && <p className="mt-4 opacity-80 max-w-2xl mx-auto">{store.customization.description}</p>}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-12">{orderedSections}</main>
    </div>
  );
}
