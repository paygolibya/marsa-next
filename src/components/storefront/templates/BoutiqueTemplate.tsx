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
 * "البوتيك" (Boutique) — the industry-mapped template for fashion, shoes &
 * bags, beauty & cosmetics, and eyewear stores (see src/lib/store-industries.ts
 * and Template.industries). Light and editorial rather than dark-elegant
 * (that's Luxury's lane): a slim utility header, a generous cream-toned hero
 * with serif-weight type and a thin divider, and portrait 3:4 product
 * imagery with understated underline-link CTAs instead of filled buttons
 * (see ProductsSection's variant="boutique" branch) — the look is meant to
 * read as "editorial catalog," not "shop."
 */
export default function BoutiqueTemplate({
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
  const primary = store.customization?.primaryColor || "#b45309";
  const secondary = store.customization?.secondaryColor || "#fdf6ec";
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
    variant: "boutique",
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
      const spacing = renderedFirst ? "mt-20" : "";
      renderedFirst = true;
      return (
        <div key={s.id ?? s.type} className={spacing}>
          {node}
        </div>
      );
    });

  return (
    <div style={{ backgroundColor: "#ffffff" }} className="min-h-screen">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-harbor/5">
        <StorefrontHeaderRow
          headerCentered={false}
          showLogo={showLogo}
          logo={store.customization?.logo}
          storeName={store.name}
          logoPx={logoPx}
          paddingClassName="py-5"
          cartOnRight={false}
          identityExtra={
            showStoreName && (
              <span className={`block min-w-0 truncate font-display font-bold tracking-wide text-harbor ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )
          }
          cartButton={
            store.type === "showcase" ? null : (
              <button
                onClick={onOpenCart}
                className="relative rounded-full border px-5 py-2 text-sm font-bold hover:bg-harbor/5 transition-colors"
                style={{ borderColor: `${primary}50`, color: colors.text }}
              >
                {t("cart.titleShort")}
                {cartTotalItems > 0 && (
                  <span
                    className="absolute -top-2 -left-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: primary }}
                  >
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

      {/* The real visual identity lives here, not the header — generous
          cream-toned whitespace, a serif-weight centered title, and a thin
          divider line rather than a filled color band (Bold's own hero). */}
      {heroEnabled && (
        <div style={{ backgroundColor: secondary }} className="px-6 py-20 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-harbor" style={{ color: colors.text }}>
            {store.customization?.tagline || t("boutique.heroHeading")}
          </h1>
          <div className="mx-auto mt-5 h-px w-16" style={{ backgroundColor: `${primary}60` }} />
          <p className={`mt-5 max-w-lg mx-auto text-harbor/70 ${textSize.body}`} style={{ color: colors.text }}>
            {store.customization?.description || t("boutique.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-14">{orderedSections}</main>
    </div>
  );
}
