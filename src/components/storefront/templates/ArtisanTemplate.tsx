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
 * "الحِرفي" (Artisan) — the industry-mapped template for home decor, gift/
 * wrapping, and bakery stores (see src/lib/store-industries.ts and
 * Template.industries). Warm terracotta/cream tones throughout (never the
 * neutral gray/white chrome every other template uses), a textured
 * gradient card background, and a small "صنع يدوي" (handmade) badge on
 * every product (see ProductsSection's variant="artisan" branch) — reads
 * as a craft/bakery storefront, not a generic shop.
 */
export default function ArtisanTemplate({
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
  const primary = store.customization?.primaryColor || "#9a3412";
  const secondary = store.customization?.secondaryColor || "#fef3e8";
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
    variant: "artisan",
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
    <div style={{ backgroundColor: "#fffaf3" }} className="min-h-screen">
      <div className="sticky top-0 z-30 bg-[#fffaf3]/95 backdrop-blur border-b" style={{ borderColor: "#e8d5bd" }}>
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

      {/* A warm textured gradient hero — terracotta/cream, never the flat
          neutral bands other templates use. */}
      {heroEnabled && (
        <div
          className="px-6 py-16 text-center"
          style={{ background: "linear-gradient(135deg, #f3e3cf, #fef3e8)" }}
        >
          <h1 className="font-display text-3xl md:text-4xl font-bold" style={{ color: colors.text || primary }}>
            {store.customization?.tagline || t("artisan.heroHeading")}
          </h1>
          <p className={`mt-4 max-w-xl mx-auto text-harbor/70 ${textSize.body}`} style={{ color: colors.text }}>
            {store.customization?.description || t("artisan.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
