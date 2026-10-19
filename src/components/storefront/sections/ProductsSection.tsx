import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatLYD, type Product } from "@/lib/api";
import { InquiryModal } from "@/components/storefront/InquiryModal";
import { translate, resolveProductTranslation, isSupportedLanguage } from "@/lib/i18n";
import { ProductImagePlaceholder } from "./ProductImagePlaceholder";
import { Icon } from "@/components/ui/Icon";
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
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
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-extrabold text-harbor text-lg hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
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
            className="w-full max-w-sm rounded-none border-0 border-b bg-transparent px-2 py-2 text-center text-white placeholder:text-white/40 focus:outline-none focus-visible:border-white focus-visible:bg-white/5"
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
                  className="aspect-[4/3] flex items-center justify-center text-white/40 text-sm border overflow-hidden group"
                  style={{ borderColor: `${colors.accent}30` }}
                >
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={900}
                      height={675}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} tone="dark" />
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

  if (variant === "boutique") {
    return (
      <div>
        <div className="flex items-center justify-between mb-10 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-bold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="input max-w-xs !rounded-none !border-0 !border-b !border-harbor/20 !bg-transparent px-1"
          />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-6 sm:gap-x-8 sm:gap-y-12">
            {filtered.map((product) => (
              <div key={product.id} className="flex flex-col">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[3/4] flex items-center justify-center overflow-hidden group bg-[#f6f1ea]">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={720}
                      height={960}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="pt-4">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display text-base font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="text-sm mt-1" style={{ color: colors.accent }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      className="mt-3 text-sm font-bold border-b-2 pb-0.5 hover:opacity-70 transition-opacity"
                      style={{ borderColor: colors.primary, color: colors.text }}
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      className="mt-3 inline-block text-sm font-bold border-b-2 pb-0.5 hover:opacity-70 transition-opacity"
                      style={{ borderColor: colors.primary, color: colors.text }}
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      className="mt-3 text-sm font-bold border-b-2 pb-0.5 hover:opacity-70 transition-opacity"
                      style={{ borderColor: colors.primary, color: colors.text }}
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

  if (variant === "playful") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-extrabold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="input max-w-xs rounded-full"
          />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-[2rem] bg-white overflow-hidden flex flex-col shadow-md transition duration-300 hover:shadow-xl hover:-rotate-1 hover:-translate-y-1"
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square flex items-center justify-center overflow-hidden group" style={{ backgroundColor: `${colors.accent}1a` }}>
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={800}
                      height={800}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display font-extrabold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-extrabold text-lg mt-1" style={{ color: colors.accent }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-full text-white py-2.5 font-extrabold shadow-md hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-full text-white py-2.5 font-extrabold text-center shadow-md hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-full text-white py-2.5 font-extrabold shadow-md hover:opacity-90 transition-opacity"
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

  if (variant === "artisan") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-bold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="input max-w-xs"
          />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl overflow-hidden flex flex-col border transition-shadow hover:shadow-lg"
                style={{ backgroundColor: "#fffaf3", borderColor: "#e8d5bd" }}
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/3] flex items-center justify-center overflow-hidden group" style={{ background: "linear-gradient(135deg, #f3e3cf, #ede0cb)" }}>
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={800}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <span className="text-[11px] font-bold tracking-wide mb-1" style={{ color: colors.accent }}>
                    {t("artisan.handmadeBadge")}
                  </span>
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-bold text-sm mt-1" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold text-sm text-center hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
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

  if (variant === "trust") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-extrabold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="input max-w-xs"
          />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-xl border bg-white overflow-hidden flex flex-col transition-shadow hover:shadow-md" style={{ borderColor: "#cbe3f5" }}>
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square flex items-center justify-center overflow-hidden group" style={{ backgroundColor: "#f0f9ff" }}>
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
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-extrabold text-lg mt-1" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold text-center hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 rounded-lg text-white py-2.5 font-bold hover:opacity-90 transition-opacity"
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

  if (variant === "tech") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-extrabold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("products.searchPlaceholder")} className="input max-w-xs !rounded-lg" />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-lg overflow-hidden flex flex-col bg-harbor border border-harbor transition-colors hover:border-white/20">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square flex items-center justify-center overflow-hidden group bg-white/5">
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
                    <ProductImagePlaceholder label={t("common.noImage")} tone="dark" />
                  )}
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-white hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  {/* Always white: the card is navy (bg-harbor) and Tech's default
                      accent is #0f172a, so prices were near-invisible. */}
                  <p className="font-mono font-extrabold text-lg mt-1.5 text-white">
                    {formatLYD(product.priceCents, language)}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-3 rounded-md text-white py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-3 rounded-md text-white py-2.5 font-bold text-sm text-center hover:opacity-90 transition-opacity"
                    >
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-3 rounded-md text-white py-2.5 font-bold text-sm hover:opacity-90 transition-opacity"
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

  if (variant === "reader") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          {settings.title && (
            <h2 className="font-display text-2xl font-bold text-harbor" style={{ color: colors.text }}>
              {settings.title}
            </h2>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("products.searchPlaceholder")}
            className="input max-w-xs !rounded-none !border-0 !border-b-2 !bg-transparent px-1"
            style={{ borderColor: `${colors.primary}50` }}
          />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-6 sm:gap-y-10">
            {filtered.map((product) => (
              <div key={product.id} className="flex flex-col">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[2/3] flex items-center justify-center overflow-hidden group shadow-md" style={{ backgroundColor: "#f0e4cc" }}>
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={640}
                      height={960}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="pt-3">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display text-sm font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="text-sm mt-1 font-bold" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}
                  </p>
                  {isShowcase ? (
                    <button onClick={() => setInquiryProduct(product)} className="mt-2 text-xs font-bold underline" style={{ color: colors.accent }}>
                      {t("common.inquire")}
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link href={`/store/${slug}/product/${product.id}`} className="mt-2 inline-block text-xs font-bold underline" style={{ color: colors.accent }}>
                      {t("common.chooseOptions")}
                    </Link>
                  ) : (
                    <button onClick={() => onAddToCart(product)} className="mt-2 text-xs font-bold underline" style={{ color: colors.accent }}>
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

  if (variant === "sport") {
    return (
      <div>
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="font-display text-2xl font-black uppercase tracking-tight text-harbor" style={{ color: colors.text }}>
            {settings.title || t("products.shopNow")}
          </h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("products.searchPlaceholder")} className="input max-w-xs" />
        </div>
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="bg-white overflow-hidden flex flex-col shadow-lg border-2 border-harbor/10 hover:border-harbor/30 transition-colors"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%)" }}
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/3] flex items-center justify-center overflow-hidden group bg-harbor/5">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={800}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-black uppercase tracking-tight text-harbor text-base hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-black text-xl mt-2 italic" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}
                  </p>
                  {isShowcase ? (
                    <button
                      onClick={() => setInquiryProduct(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 py-3 font-black uppercase text-sm text-white text-center -skew-x-6 hover:opacity-90 transition-opacity"
                    >
                      <span className="inline-block skew-x-6">{t("common.inquire")}</span>
                    </button>
                  ) : product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 py-3 font-black uppercase text-sm text-white text-center -skew-x-6 hover:opacity-90 transition-opacity"
                    >
                      <span className="inline-block skew-x-6">{t("common.chooseOptions")}</span>
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: colors.primary }}
                      className="mt-4 py-3 font-black uppercase text-sm text-white text-center -skew-x-6 hover:opacity-90 transition-opacity"
                    >
                      <span className="inline-block skew-x-6">{t("common.addToCart")}</span>
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
              <div key={product.id} className="rounded-lg border border-harbor/10 bg-white overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <Link href={`/store/${slug}/product/${product.id}`} className="relative aspect-square bg-harbor/5 flex items-center justify-center text-rope text-xs overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={600}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                  {stats?.averageRating != null && stats.reviewCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5">
                      <Icon name="star" size={10} filled strokeWidth={1.5} className="text-brass" />
                      {stats.averageRating.toFixed(1)}
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

  if (variant === "booking") {
    return (
      <div>
        {settings.title && <h2 className="font-display text-xl font-extrabold text-harbor mb-6" style={{ color: colors.text }}>{settings.title}</h2>}
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/3] bg-harbor/5 flex items-center justify-center text-rope text-sm relative overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={800}
                      height={600}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                  {store.bookingSlotMinutes && (
                    <span className="absolute top-2 right-2 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: colors.accent }}>
                      {t("booking.duration", { minutes: store.bookingSlotMinutes })}
                    </span>
                  )}
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-bold text-sm mt-1" style={{ color: colors.primary }}>
                    {formatLYD(product.priceCents, language)}
                  </p>
                  <button
                    onClick={() => onAddToCart(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    {t("booking.bookNow")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (variant === "rental") {
    return (
      <div>
        {settings.title && <h2 className="font-display text-xl font-extrabold text-harbor mb-6" style={{ color: colors.text }}>{settings.title}</h2>}
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid sm:grid-cols-2 gap-8">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/3] bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={productName(product)}
                      width={900}
                      height={675}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <ProductImagePlaceholder label={t("common.noImage")} />
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-extrabold text-harbor text-lg hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <p className="font-extrabold text-lg mt-2" style={{ color: colors.accent }}>
                    {formatLYD(product.priceCents, language)}{t("common.perDay")}
                  </p>
                  <button
                    onClick={() => onAddToCart(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 rounded-xl text-white py-3 font-extrabold hover:opacity-90 transition-opacity"
                  >
                    {t("rental.rentNow")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (variant === "showcase") {
    return (
      <div>
        {settings.title && <h2 className="font-display text-xl font-extrabold text-harbor mb-6" style={{ color: colors.text }}>{settings.title}</h2>}
        {filtered.length === 0 ? (
          empty
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
              >
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
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
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-harbor hover:underline leading-snug line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                    {productName(product)}
                  </Link>
                  <button
                    onClick={() => setInquiryProduct(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    {t("common.inquire")}
                  </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {filtered.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col transition duration-300 hover:shadow-lg hover:-translate-y-0.5"
            >
              <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
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
              <div className="p-3 sm:p-4 flex flex-col flex-1">
                {/* Two-line clamp + min height and an mt-auto button keep
                    cards in the same row aligned now that phones show two
                    per row (pattern from 21st.dev's Product Card). */}
                <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-sm sm:text-base leading-snug text-harbor hover:underline line-clamp-2 min-h-[2.5em]" style={{ color: colors.text }}>
                  {productName(product)}
                </Link>
                <p className="font-bold text-sm mt-1 mb-3" style={{ color: colors.primary }}>
                  {formatLYD(product.priceCents, language)}{store.type === "rental" && t("common.perDay")}
                </p>
                {isShowcase ? (
                  <button
                    onClick={() => setInquiryProduct(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-auto rounded-full text-white py-2 font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity"
                  >
                    {t("common.inquire")}
                  </button>
                ) : product.variantOptions?.length ? (
                  <Link
                    href={`/store/${slug}/product/${product.id}`}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-auto rounded-full text-white py-2 font-bold text-xs sm:text-sm text-center hover:opacity-90 transition-opacity"
                  >
                    {t("common.chooseOptions")}
                  </Link>
                ) : (
                  <button
                    onClick={() => onAddToCart(product)}
                    style={{ backgroundColor: colors.primary }}
                    className="mt-auto rounded-full text-white py-2 font-bold text-xs sm:text-sm hover:opacity-90 transition-opacity"
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
