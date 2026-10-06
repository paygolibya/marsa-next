import { ProductsSection, CategoriesSection, TestimonialsSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { StorefrontHeaderRow } from "./StorefrontHeaderRow";
import { StorefrontNavRow } from "./StorefrontNavRow";
import { resolveLogoSizePx, resolveTextSizeClass, type StorefrontTemplateProps } from "./types";

// "stats" (delivered-order counts don't apply — showcase stores have no
// checkout at all), "bundles" (nothing to buy together), and "newsletter"
// (a portfolio-feel page, not a shop collecting marketing signups) are all
// omitted — only the sections that actually fit a catalog-to-inquire flow.
const SECTION_COMPONENTS: Partial<Record<SectionType, (props: SectionRenderProps) => React.ReactNode>> = {
  products: ProductsSection,
  categories: CategoriesSection,
  testimonials: TestimonialsSection,
};

/**
 * Dedicated template for "showcase" stores — no price/cart UI anywhere.
 * Every product card's only action is "استفسر" (Inquire), reusing the
 * already-wired InquiryModal via ProductsSection's variant="showcase"
 * branch, as the template's only mode rather than a conditional fallback
 * the generic templates also carry. Larger, gallery-style cards (no price
 * line at all) instead of the dense buy-focused grids elsewhere.
 */
export default function ShowcaseTemplate({
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
  newsletterEmail,
  setNewsletterEmail,
  newsletterState,
  onNewsletterSubmit,
  sections,
}: StorefrontTemplateProps) {
  const primary = store.customization?.primaryColor || "#18181b";
  const secondary = store.customization?.secondaryColor || "#fafafa";
  const accent = store.customization?.accentColor || primary;
  const showLogo = store.customization?.showLogo !== false;
  const showStoreName = store.customization?.showStoreName !== false;
  const logoPx = resolveLogoSizePx(store.customization?.logoSize);
  const textColor = store.customization?.textColor || undefined;
  const textSize = resolveTextSizeClass(store.customization?.textSize);
  const colors = { primary, secondary, accent, text: textColor };
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string) => translate(language, key);

  // onAddToCart/onAddBundleToCart are part of the shared SectionRenderProps
  // contract but never actually invoked here — a showcase store has no
  // cart at all, so ProductsSection's variant="showcase" branch never
  // calls them (it only opens the inquiry modal).
  const sectionProps: Omit<SectionRenderProps, "settings"> = {
    variant: "showcase",
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
    onAddToCart: () => {},
    onAddBundleToCart: () => {},
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
          // No cart button at all — showcase stores have no checkout.
          cartButton={null}
        />
      </header>

      <StorefrontNavRow navMenuItems={navMenuItems} primaryColor={primary} />

      <div className="px-6 py-14 text-center">
        <h1 className="font-display text-3xl font-extrabold text-harbor" style={{ color: colors.text }}>
          {store.customization?.tagline || t("showcase.heroHeading")}
        </h1>
        <p className={`mt-3 max-w-xl mx-auto text-harbor/70 ${textSize.body}`}>
          {store.customization?.description || t("showcase.heroSubtext")}
        </p>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-10">{orderedSections}</main>
    </div>
  );
}
