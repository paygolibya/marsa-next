import { StatsSection, ProductsSection, CategoriesSection, CategoryShowcaseSection, BundlesSection, BestSellersSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { StorefrontNavRow } from "./StorefrontNavRow";
import {
  resolveCoverImageHeightClass,
  resolveLogoSizePx,
  resolveTextSizeClass,
  type StorefrontTemplateProps,
} from "./types";

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
 * "الرياضي" (Sport) — the industry-mapped template for sports_fitness
 * stores, split off from Bold (which it used to share purely for its
 * general "loud/energetic" feel, not an athletic one specifically). The
 * sport identity comes from a genuinely diagonal visual language, not
 * just a palette swap: a clip-path-cut hero band with an angled bottom
 * edge, product cards with a matching diagonal-cut corner, and skewed
 * uppercase CTA buttons (their label text counter-skewed back upright)
 * — distinct from Bold's rounded-3xl chunky-shadow cards.
 */
export default function SportTemplate({
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
  const primary = store.customization?.primaryColor || "#16a34a";
  const secondary = store.customization?.secondaryColor || "#f0fdf4";
  const accent = store.customization?.accentColor || "#14532d";
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
    variant: "sport",
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
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-harbor/5">
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
              <span className={`block min-w-0 truncate font-display font-black uppercase tracking-tight text-harbor ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )
          }
          cartButton={
            store.type === "showcase" ? null : (
              <button
                onClick={onOpenCart}
                style={{ backgroundColor: primary }}
                className="relative px-5 py-2 text-white font-black uppercase text-sm -skew-x-6 hover:opacity-90 transition-opacity"
              >
                <span className="inline-block skew-x-6">{t("cart.titleShort")}</span>
                {cartTotalItems > 0 && (
                  <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
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

      {/* Diagonal-cut hero — the clip-path angled bottom edge is the
          distinguishing athletic feature, carried through again on every
          product card below. */}
      {heroEnabled && (
        <div
          style={{ backgroundColor: primary, clipPath: "polygon(0 0, 100% 0, 100% 85%, 0 100%)" }}
          className="text-white text-center px-6 pt-16 pb-24"
        >
          <h1 className="font-display text-4xl md:text-6xl font-black uppercase tracking-tight mb-3 leading-tight">
            {store.customization?.tagline || t("sport.heroHeading")}
          </h1>
          <p className="mt-2 max-w-xl mx-auto text-white/80">
            {store.customization?.description || t("sport.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
