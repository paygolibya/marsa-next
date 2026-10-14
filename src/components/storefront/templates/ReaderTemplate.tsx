import { StatsSection, ProductsSection, CategoriesSection, CategoryShowcaseSection, BundlesSection, BestSellersSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { StorefrontNavRow } from "./StorefrontNavRow";
import { resolveCoverImageHeightClass, resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

const SECTION_COMPONENTS: Record<SectionType, (props: SectionRenderProps) => React.ReactNode> = {
  stats: StatsSection,
  products: ProductsSection,
  categories: CategoriesSection,
  categoryShowcase: CategoryShowcaseSection,
  bundles: BundlesSection,
  bestSellers: BestSellersSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "القارئ" (Reader) — the industry-mapped template for book and stationery
 * stores (see src/lib/store-industries.ts and Template.industries) — the
 * other half of what Marketplace used to share with electronics (now
 * Tech), despite a bookshop and a gadget shop having little in common.
 * Warm sepia/cream, book-cover-ratio (2:3, portrait) product imagery with
 * a soft drop shadow, understated underline CTAs — a cozy "reading nook"
 * feel, distinct from Artisan's terracotta warmth and Boutique's cooler
 * editorial cream.
 */
export default function ReaderTemplate({
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
  const primary = store.customization?.primaryColor || "#92400e";
  const secondary = store.customization?.secondaryColor || "#fdf8ee";
  const accent = store.customization?.accentColor || primary;
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const heroEnabled = store.customization?.heroEnabled !== false;
  const colors = { primary, secondary, accent, text: textColor };
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string) => translate(language, key);

  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "reader",
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
      <div className="sticky top-0 z-30 bg-[#fdf8ee]/95 backdrop-blur border-b" style={{ borderColor: "#e8d9bd" }}>
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
              <span className={`block min-w-0 truncate font-display font-bold text-harbor ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )
          }
          cartButton={
            store.type === "showcase" ? null : (
              <button
                onClick={onOpenCart}
                className="relative rounded-full border-2 px-5 py-2 font-bold text-sm hover:opacity-80 transition-opacity"
                style={{ borderColor: primary, color: primary }}
              >
                {t("cart.titleShort")}
                {cartTotalItems > 0 && (
                  <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: primary }}>
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
        <div className="px-6 py-16 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-harbor" style={{ color: colors.text }}>
            {store.customization?.tagline || t("reader.heroHeading")}
          </h1>
          <div className="mx-auto mt-5 h-px w-16" style={{ backgroundColor: `${primary}60` }} />
          <p className={`mt-5 max-w-lg mx-auto text-harbor/70 ${textSize.body}`} style={{ color: colors.text }}>
            {store.customization?.description || t("reader.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
