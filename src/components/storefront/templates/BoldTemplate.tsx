import Image from "next/image";
import { StatsSection, ProductsSection, TestimonialsSection, NewsletterSection } from "@/components/storefront/sections";
import type { SectionRenderProps, SectionType } from "@/components/storefront/sections/types";
import { StorefrontLogo } from "./StorefrontLogo";
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
        {/* min-h-14 keeps the bar tall enough for the absolutely-positioned
            cart button below — without it, when the logo uses the
            zero-height overflow trick and the name is hidden, the row's
            flow content collapses to ~0 and the button (no longer a flex
            sibling, since its position is now independent of the logo)
            overflows past the bar's own edges instead of sitting inside it. */}
        <div className={`relative min-h-14 mx-auto max-w-6xl px-6 py-3 flex items-center gap-4 ${headerCentered ? "flex-col justify-center text-center" : ""}`}>
          <div className={`flex items-center gap-2 ${headerCentered ? "flex-col" : ""}`}>
            {showLogo && store.customization?.logo && (headerCentered ? (
              // Same constraint as ModernTemplate's centered mode — the
              // overflow-past-the-bar trick only works as a flex-row
              // sibling, so centered (flex-column) mode falls back to a
              // plain sized image instead.
              <Image src={store.customization.logo} alt={store.name} width={logoPx} height={logoPx} unoptimized className="rounded-full object-cover" style={{ width: logoPx, height: logoPx }} />
            ) : (
              <StorefrontLogo src={store.customization.logo} alt={store.name} sizePx={logoPx} />
            ))}
            {showStoreName && (
              <span className={`font-display font-extrabold text-harbor ${textSize.heading}`} style={{ color: colors.text }}>
                {store.name}
              </span>
            )}
          </div>
          {/* Positioned independently of the logo/name group above — cart
              placement is its own merchant choice, not tied to headerStyle. */}
          <button
            onClick={onOpenCart}
            style={{ backgroundColor: primary }}
            className={`absolute top-1/2 -translate-y-1/2 ${cartOnRight ? "right-6" : "left-6"} rounded-xl px-5 py-2 text-white font-extrabold text-sm shadow-lg hover:opacity-90 transition-opacity`}
          >
            🛒 السلة
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-harbor text-[11px] font-bold flex items-center justify-center text-white">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
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
