import { ProductsSection, CategoriesSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { StorefrontNavRow } from "./StorefrontNavRow";
import { resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

// Neither "stats" (delivered-order counts don't read as a trust signal for
// a booking business the way they do for a shop) nor "bundles" (bundling
// services together isn't a thing this template offers) are included here
// — same "only the sections that make sense for this type" approach
// MarketplaceTemplate already established for omitting "stats".
const SECTION_COMPONENTS: Partial<Record<SectionType, (props: SectionRenderProps) => React.ReactNode>> = {
  products: ProductsSection,
  categories: CategoriesSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * Dedicated template for "booking" stores — every product is rendered as
 * a bookable service (duration badge from Store.bookingSlotMinutes, a
 * "احجز الآن" CTA instead of "أضف إلى السلة") via ProductsSection's
 * variant="booking" branch, and the hero speaks directly to scheduling an
 * appointment rather than shopping. The actual date/time slot picker still
 * lives in checkout (src/app/store/[slug]/checkout/page.tsx) — this
 * template doesn't duplicate it, just sets the right expectation up front.
 */
export default function BookingTemplate({
  store,
  filtered,
  query,
  setQuery,
  categories,
  selectedCategoryId,
  setSelectedCategoryId,
  bundles,
  navMenuItems,
  stats,
  testimonials,
  cartTotalItems,
  onOpenCart,
  onAddToCart,
  onAddBundleToCart,
  newsletterEmail,
  setNewsletterEmail,
  newsletterState,
  onNewsletterSubmit,
  sections,
}: StorefrontTemplateProps) {
  const primary = store.customization?.primaryColor || "#0d9488";
  const secondary = store.customization?.secondaryColor || "#f0fdfa";
  const accent = store.customization?.accentColor || primary;
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const colors = { primary, secondary, accent, text: textColor };
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string) => translate(language, key);

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "booking",
    colors,
    store,
    filtered,
    query,
    setQuery,
    categories,
    selectedCategoryId,
    setSelectedCategoryId,
    bundles,
    stats,
    testimonials,
    onAddToCart,
    onAddBundleToCart,
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
      <header className="sticky top-0 z-30 bg-white border-b border-harbor/10">
        <StorefrontHeaderRow
          headerCentered={false}
          showLogo={showLogo}
          logo={store.customization?.logo}
          storeName={store.name}
          logoPx={logoPx}
          paddingClassName="py-4"
          cartOnRight={false}
          identityExtra={
            showStoreName && (
              <span className={`font-display font-extrabold text-harbor truncate ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )
          }
          cartButton={
            <button
              onClick={onOpenCart}
              style={{ backgroundColor: primary }}
              className="relative rounded-full px-5 py-2 text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {t("booking.cartLabel")}
              {cartTotalItems > 0 && (
                <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                  {cartTotalItems}
                </span>
              )}
            </button>
          }
        />
      </header>

      <StorefrontNavRow navMenuItems={navMenuItems} primaryColor={primary} />

      <div className="px-6 py-14 text-center" style={{ backgroundColor: `${primary}10` }}>
        <h1 className="font-display text-3xl font-extrabold text-harbor" style={{ color: colors.text }}>
          {store.customization?.tagline || t("booking.heroHeading")}
        </h1>
        <p className={`mt-3 max-w-xl mx-auto text-harbor/70 ${textSize.body}`}>
          {store.customization?.description || t("booking.heroSubtext")}
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
