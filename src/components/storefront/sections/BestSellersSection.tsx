import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import { translate, resolveProductTranslation, isSupportedLanguage } from "@/lib/i18n";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";
import { safeParseSettings, bestSellersSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

// One shared card-grid design across every template that renders it — same
// tradeoff CategoriesSection/BundlesSection already make. Never rendered
// for showcase stores (see each template's own SECTION_COMPONENTS map):
// a showcase store never creates real Order rows, so "best seller by sales"
// is meaningless there — only the merchant-pinned half of this section
// would ever apply, and that's not worth a bespoke exception here.
export function BestSellersSection({ colors, store, bestSellers, onAddToCart, settings: rawSettings }: SectionRenderProps) {
  const settings = safeParseSettings(bestSellersSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const productName = (p: (typeof bestSellers)[number]) => resolveProductTranslation(p, language).name;
  if (bestSellers.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-display text-xl font-extrabold mb-4" style={{ color: colors.text }}>
        {settings.title || t("bestSellers.heading")}
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {bestSellers.map((product) => (
          <div
            key={product.id}
            className="relative rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
          >
            <span
              className="absolute top-3 right-3 z-10 rounded-full px-3 py-1 text-[11px] font-bold text-white"
              style={{ backgroundColor: colors.accent }}
            >
              {t("bestSellers.badge")}
            </span>
            <Link href={`/store/${store.slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={productName(product)}
                  width={800}
                  height={800}
                  unoptimized
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <ProductImagePlaceholder label={t("common.noImage")} />
              )}
            </Link>
            <div className="p-4 flex flex-col flex-1">
              <Link href={`/store/${store.slug}/product/${product.id}`} className="font-bold text-harbor hover:underline" style={{ color: colors.text }}>
                {productName(product)}
              </Link>
              <p className="font-bold text-sm mt-1" style={{ color: colors.primary }}>
                {formatLYD(product.priceCents, language)}
              </p>
              {product.variantOptions?.length ? (
                <Link
                  href={`/store/${store.slug}/product/${product.id}`}
                  style={{ backgroundColor: colors.primary }}
                  className="mt-4 rounded-full text-white py-2 font-bold text-sm text-center hover:opacity-90 transition-opacity"
                >
                  {t("common.chooseOptions")}
                </Link>
              ) : (
                <button
                  onClick={() => onAddToCart(product)}
                  style={{ backgroundColor: colors.primary }}
                  className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  {t("common.addToCart")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
