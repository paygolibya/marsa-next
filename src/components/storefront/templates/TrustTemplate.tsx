import { ProductsSection, CategoriesSection, CategoryShowcaseSection, BundlesSection, BestSellersSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { Icon } from "@/components/ui/Icon";
import { StorefrontNavRow } from "./StorefrontNavRow";
import { resolveCoverImageHeightClass, resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

// "stats" has no entry here — its data already renders as the hero's own
// trust strip below (same real stats, not a duplicate), matching how
// MarketplaceTemplate/BookingTemplate already omit "stats" from their own
// section map when they show it inline elsewhere instead.
const SECTION_COMPONENTS: Partial<Record<SectionType, (props: SectionRenderProps) => React.ReactNode>> = {
  products: ProductsSection,
  categories: CategoriesSection,
  categoryShowcase: CategoryShowcaseSection,
  bundles: BundlesSection,
  bestSellers: BestSellersSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "الثقة" (Trust) — the industry-mapped template for pharmacy/health,
 * medical equipment, and cleaning supply stores (see
 * src/lib/store-industries.ts and Template.industries). Clean clinical
 * blue/white, high-contrast minimal cards, and a trust-signal strip in the
 * hero built from the store's OWN real stats (delivered orders, rating —
 * see StoreStats) rather than any fabricated "certified"/"guaranteed"
 * marketing copy — only ever shows what's actually true of this store.
 */
export default function TrustTemplate({
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
  bestSellers,
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
  const primary = store.customization?.primaryColor || "#0369a1";
  const secondary = store.customization?.secondaryColor || "#f0f9ff";
  const accent = store.customization?.accentColor || primary;
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const heroEnabled = store.customization?.heroEnabled !== false;
  const colors = { primary, secondary, accent, text: textColor };
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const showRating = stats?.averageRating != null && stats.reviewCount > 0;

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "trust",
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
    bestSellers,
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
    <div style={{ backgroundColor: "#ffffff" }} className="min-h-screen">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b" style={{ borderColor: "#cbe3f5" }}>
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
                className="relative rounded-lg px-5 py-2 text-white font-bold text-sm hover:opacity-90 transition-opacity"
              >
                {t("cart.titleShort")}
                {cartTotalItems > 0 && (
                  <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-white text-[11px] font-bold flex items-center justify-center" style={{ color: primary }}>
                    {cartTotalItems}
                  </span>
                )}
              </button>
            )
          }
        />
      </div>

      <StorefrontNavRow navMenuItems={navMenuItems} primaryColor={primary} />

      {store.customization?.coverImage && (
        <div className={`w-full overflow-hidden ${resolveCoverImageHeightClass(store.customization?.coverImageSize)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={store.customization.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {heroEnabled && (
        <div style={{ backgroundColor: secondary }} className="px-6 py-16 text-center">
          <h1 className="font-display text-3xl font-extrabold text-harbor" style={{ color: colors.text }}>
            {store.customization?.tagline || t("trust.heroHeading")}
          </h1>
          <p className={`mt-3 max-w-xl mx-auto text-harbor/70 ${textSize.body}`} style={{ color: colors.text }}>
            {store.customization?.description || t("trust.heroSubtext")}
          </p>
          {/* Trust strip — only real data, no fabricated claims. */}
          {stats && (stats.deliveredOrderCount > 0 || showRating) && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {stats.deliveredOrderCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm" style={{ color: primary }}>
                  <Icon name="checkCircle" size={16} />
                  {t("stats.deliveredCombined", { count: stats.deliveredOrderCount })}
                </span>
              )}
              {showRating && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-bold shadow-sm" style={{ color: primary }}>
                  <Icon name="checkCircle" size={16} />
                  {t("stats.ratingWithCount", { rating: stats.averageRating!.toFixed(1), count: stats.reviewCount })}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
