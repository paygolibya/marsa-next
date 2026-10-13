import { StatsSection, ProductsSection, CategoriesSection, BundlesSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { StorefrontNavRow } from "./StorefrontNavRow";
import { resolveCoverImageHeightClass, resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

const SECTION_COMPONENTS: Record<SectionType, (props: SectionRenderProps) => React.ReactNode> = {
  stats: StatsSection,
  products: ProductsSection,
  categories: CategoriesSection,
  bundles: BundlesSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
};

/**
 * "التقنية" (Tech) — the industry-mapped template for electronics stores
 * (see src/lib/store-industries.ts and Template.industries) — split off
 * from Marketplace, which it used to share with books_stationery despite
 * having almost nothing in common besides "dense grid." A LIGHT page
 * (not dark) — CategoriesSection/TestimonialsSection/NewsletterSection/
 * StatsSection all assume a light page in their shared "modern" default
 * variant (hardcoded dark text, e.g. text-harbor headings), so a fully
 * dark page would make those unreadable without giving every one of
 * them its own dark-aware variant too (the one thing Luxury does, and
 * deliberately not repeated here — see ProductsSection's own comment).
 * The tech identity instead comes from a self-contained dark hero band
 * (same contained-block pattern every other template's hero already
 * uses) and dark, sharp-cornered product cards floating on the light
 * page — distinct from Trust's clinical light-blue and Luxury's
 * gold-on-dark without touching the rest of the page.
 */
export default function TechTemplate({
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
  const primary = store.customization?.primaryColor || "#2563eb";
  const secondary = store.customization?.secondaryColor || "#f1f5f9";
  const accent = store.customization?.accentColor || "#0f172a";
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
    variant: "tech",
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

      {/* Self-contained dark band — same pattern every other template's
          hero already uses (Booking/Trust/Playful/Artisan), not the whole
          page — this is what carries the tech identity. */}
      {heroEnabled && (
        <div className="px-6 py-16 text-center" style={{ backgroundColor: accent }}>
          <h1 className="font-display text-3xl font-extrabold text-white">
            {store.customization?.tagline || t("tech.heroHeading")}
          </h1>
          <p className="mt-3 max-w-xl mx-auto text-white/60">
            {store.customization?.description || t("tech.heroSubtext")}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
