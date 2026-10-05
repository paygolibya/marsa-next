import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatLYD, type Product } from "@/lib/api";
import { InquiryModal } from "@/components/storefront/InquiryModal";
import { translate, resolveProductTranslation, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, productsSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

export function ProductsSection({
  variant,
  colors,
  settings: rawSettings,
  store,
  filtered,
  query,
  setQuery,
  stats,
  onAddToCart,
}: SectionRenderProps) {
  const settings = safeParseSettings(productsSettingsSchema, rawSettings);
  const slug = store.slug;
  const isShowcase = store.type === "showcase";
  const [inquiryProduct, setInquiryProduct] = useState<Product | null>(null);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const productName = (p: Product) => resolveProductTranslation(p, language).name;

  const inquiryModal = (
    <InquiryModal
      open={inquiryProduct !== null}
      onClose={() => setInquiryProduct(null)}
      storeSlug={slug}
      productId={inquiryProduct?.id}
      productName={inquiryProduct ? productName(inquiryProduct) : undefined}
      language={language}
    />
  );

  const empty = <p className="text-rope text-center py-16">{t("products.noResults")}</p>;

  if (variant === "bold") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="font-display text-2xl font-extrabold text-harbor" style={{ color: colors.text }}>{settings.title || t("products.shopNow")}</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("products.searchPlaceholder")} className="input max-w-xs" />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-3xl bg-white overflow-hidden flex flex-col shadow-xl hover:-translate-y-1 transition-transform">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/5] bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={800}
                      height={1000}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    t("common.noImage")
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-extrabold text-harbor text-lg hover:underline" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-extrabold text-lg mt-2" style={{ color: colors.accent }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-xl text-white py-3 font-extrabold shadow-lg hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-xl text-white py-3 font-extrabold text-center shadow-lg hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-xl text-white py-3 font-extrabold shadow-lg hover:opacity-90 transition-opacity"
                    >
                      {t("common.addToCart")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {inquiryModal}
      </div>
    );
  }

  if (variant === "luxury") {
    return (
      <div>
        {settings.title && <h2 className="font-display text-xl font-extrabold mb-8 text-center tracking-wide" style={{ color: colors.accent }}>{settings.title}</h2>}
        <div className="flex justify-center mb-12">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="w-full max-w-sm rounded-none border-0 border-b bg-transparent px-2 py-2 text-center text-white placeholder:text-white/40 focus:outline-none"
            style={{ borderColor: `${colors.accent}50` }}
          />
        </div>
        {filtered.length === 0 ? (
          <p className="text-white/50 text-center py-16">{t("products.noResults")}</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-10">
            {filtered.map((product) => (
              <div key={product.id} className="flex flex-col">
                <Link
                  href={`/store/${slug}/product/${product.id}`}
                  className="aspect-[4/3] flex items-center justify-center text-white/40 text-sm border"
                  style={{ borderColor: `${colors.accent}30` }}
                >
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={productName(product)} width={900} height={675} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    t("common.noImage")
                  )}
                </Link>
                <div className="pt-4 text-center">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display text-lg font-bold hover:underline">
                    {productName(product)}
                  </Link>
                  <p className="mt-1 text-sm font-bold tracking-wide" style={{ color: colors.accent }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      className="mt-3 rounded-full border px-6 py-2 text-xs font-bold tracking-widest hover:bg-white/5 transition-colors"
                      style={{ borderColor: colors.accent, color: colors.accent }}
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      className="mt-3 inline-block rounded-full border px-6 py-2 text-xs font-bold tracking-widest hover:bg-white/5 transition-colors"
                      style={{ borderColor: colors.accent, color: colors.accent }}
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      className="mt-3 rounded-full border px-6 py-2 text-xs font-bold tracking-widest hover:bg-white/5 transition-colors"
                      style={{ borderColor: colors.accent, color: colors.accent }}
                    >
                      {t("common.addToCart")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {inquiryModal}
      </div>
    );
  }

  if (variant === "marketplace") {
    return (
      <div>
        {settings.title && <h2 className="font-display text-lg font-extrabold text-harbor mb-4" style={{ color: colors.text }}>{settings.title}</h2>}
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-lg border border-harbor/10 bg-white overflow-hidden flex flex-col">
                <Link href={`/store/${slug}/product/${product.id}`} className="relative aspect-square bg-harbor/5 flex items-center justify-center text-rope text-xs">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={productName(product)} width={600} height={600} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    t("common.noImage")
                  )}
                  {stats?.averageRating != null && stats.reviewCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5">
                      ★ {stats.averageRating.toFixed(1)}
                    </span>
                  )}
                </Link>
                <div className="p-2.5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="text-sm font-bold text-harbor hover:underline line-clamp-2" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-extrabold text-sm mt-1" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-2 rounded text-white py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-2 rounded text-white py-1.5 text-xs font-bold text-center hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-2 rounded text-white py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      {t("common.addToCart")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {inquiryModal}
      </div>
    );
  }

  // modern
  return (
    <div>
      {settings.title && <h2 className="font-display text-xl font-extrabold text-harbor mb-4" style={{ color: colors.text }}>{settings.title}</h2>}
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("products.searchPlaceholder")} className="input mb-8 max-w-sm" />
      {filtered.length === 0 ? (
        empty
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((product) => (
            <div key={product.id} className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col">
              <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={productName(product)} width={800} height={800} unoptimized className="h-full w-full object-cover" />
                ) : (
                  t("common.noImage")
                )}
              </Link>
              <div className="p-4 flex flex-col flex-1">
                <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-harbor hover:underline" style={{ color: colors.text }}>
                  {productName(product)}
                </Link>
                <p className="font-bold text-sm mt-1" style={{ color: colors.primary }}>
                  {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                </p>
                {isShowcase ? (
                  <button
                    onClick={() => setInquiryProduct(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    {t("common.inquire")}
                  </button>
                ) : product.variantOptions?.length ? (
                  <Link
                    href={`/store/${slug}/product/${product.id}`}
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
      )}
      {inquiryModal}
    </div>
  );
}
