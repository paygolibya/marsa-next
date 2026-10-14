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
 * "المرح" (Playful) — the industry-mapped template for baby/kids and pet
 * supply stores (see src/lib/store-industries.ts and Template.industries).
 * Soft, rounded, and warm rather than sharp/minimal: a gradient hero band,
 * fully rounded pill controls, and bubbly `rounded-[2rem]` product cards
 * with a playful tilt-on-hover (see ProductsSection's variant="playful"
 * branch) — distinct from Bold's sharp chunky-shadow energy and from every
 * other template's flat rectangular cards.
 */
export default function PlayfulTemplate({
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
  const primary = store.customization?.primaryColor || "#ec4899";
  const secondary = store.customization?.secondaryColor || "#fdf2f8";
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
    variant: "playful",
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
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur">
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
                className="relative rounded-full px-5 py-2 text-white font-extrabold text-sm shadow-md hover:opacity-90 transition-opacity"
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
        <div className={`w-full overflow-hidden rounded-b-[2.5rem] ${resolveCoverImageHeightClass(store.customization?.coverImageSize)}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={store.customization.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* A soft gradient band (not a flat color fill like Bold/Booking/
          Rental) — the warmest, roundest hero of any template. */}
      {heroEnabled && (
        <div
          className="px-6 py-16 text-center"
          style={{ background: `linear-gradient(135deg, ${primary}20, ${secondary})` }}
        >
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-harbor" style={{ color: colors.text }}>
            {store.customization?.tagline || t("playful.heroHeading")}
          </h1>
          <p className={`mt-4 max-w-xl mx-auto text-harbor/70 ${textSize.body}`} style={{ color: colors.text }}>
            {store.customization?.description || t("playful.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
