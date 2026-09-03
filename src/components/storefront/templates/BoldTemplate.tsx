import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { StorefrontTemplateProps } from "./types";

/**
 * "المميز" (Bold) — a real structural departure from Modern, not a
 * recolor: a full-bleed hero with oversized type instead of a slim header
 * bar, a stats banner instead of subtle pills, taller product images with
 * a hover-zoom, and a chunky shadowed CTA style throughout.
 */
export default function BoldTemplate({
  slug,
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
}: StorefrontTemplateProps) {
  const primary = store.customization?.primaryColor || "#ef4444";
  const secondary = store.customization?.secondaryColor || "#fef2f2";
  const accent = store.customization?.accentColor || primary;

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      {/* Slim utility bar — logo + cart only, the hero below carries the weight */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-harbor/5">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {store.customization?.logo && (
              <Image src={store.customization.logo} alt={store.name} width={32} height={32} unoptimized className="h-8 w-8 rounded-full object-cover" />
            )}
            <span className="font-display font-extrabold text-harbor">{store.name}</span>
          </div>
          <button
            onClick={onOpenCart}
            style={{ backgroundColor: primary }}
            className="relative rounded-xl px-5 py-2 text-white font-extrabold text-sm shadow-lg hover:opacity-90 transition-opacity"
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

      {/* Full-bleed hero */}
      <div style={{ backgroundColor: primary }} className="text-white text-center py-16 px-6">
        <h1 className="font-display text-4xl md:text-6xl font-extrabold mb-3 leading-tight">{store.name}</h1>
        {store.customization?.tagline && <p className="text-lg md:text-xl opacity-90 max-w-xl mx-auto">{store.customization.tagline}</p>}
        {store.customization?.description && <p className="mt-4 opacity-80 max-w-2xl mx-auto">{store.customization.description}</p>}
      </div>

      {store.customization?.showSocialProof !== false && stats && (stats.deliveredOrderCount > 0 || stats.reviewCount > 0) && (
        <div className="bg-harbor text-white py-4 px-6">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-center gap-8 text-center">
            {stats.deliveredOrderCount > 0 && (
              <div>
                <p className="font-display text-2xl font-extrabold">+{stats.deliveredOrderCount}</p>
                <p className="text-xs opacity-70">طلب تم تسليمه</p>
              </div>
            )}
            {stats.averageRating != null && stats.reviewCount > 0 && (
              <div>
                <p className="font-display text-2xl font-extrabold">★ {stats.averageRating.toFixed(1)}</p>
                <p className="text-xs opacity-70">{stats.reviewCount} تقييم</p>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="font-display text-2xl font-extrabold text-harbor">تسوّق الآن</h2>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن منتج..." className="input max-w-xs" />
        </div>

        {filtered.length === 0 ? (
          <p className="text-rope text-center py-16">لا توجد منتجات مطابقة حاليًا.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-3xl bg-white overflow-hidden flex flex-col shadow-xl hover:-translate-y-1 transition-transform">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-[4/5] bg-harbor/5 flex items-center justify-center text-rope text-sm overflow-hidden group">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={800}
                      height={1000}
                      unoptimized
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    "لا توجد صورة"
                  )}
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-extrabold text-harbor text-lg hover:underline">
                    {product.name}
                  </Link>
                  <p className="font-extrabold text-xl mt-2" style={{ color: accent }}>
                    {formatLYD(product.priceCents)}
                  </p>
                  {product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: primary }}
                      className="mt-4 rounded-xl text-white py-3 font-extrabold text-center shadow-lg hover:opacity-90 transition-opacity"
                    >
                      اختر الخيارات
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: primary }}
                      className="mt-4 rounded-xl text-white py-3 font-extrabold shadow-lg hover:opacity-90 transition-opacity"
                    >
                      أضف إلى السلة
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {store.customization?.showTestimonials && testimonials.length > 0 && (
          <div className="mt-20">
            <h2 className="font-display text-2xl font-extrabold text-harbor mb-8 text-center">ماذا يقول عملاؤنا</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl bg-white p-6 shadow-lg">
                  <p className="text-lg mb-3" style={{ color: accent }}>
                    {"★".repeat(t.rating)}
                    {"☆".repeat(5 - t.rating)}
                  </p>
                  {t.reviewText && <p className="text-harbor/80 mb-4">&quot;{t.reviewText}&quot;</p>}
                  <p className="text-xs font-bold text-rope">
                    {t.buyerName} — {t.productName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.customization?.showNewsletter && (
          <div className="mt-20 rounded-3xl p-10 text-center max-w-xl mx-auto text-white shadow-2xl" style={{ backgroundColor: primary }}>
            <h3 className="font-display text-2xl font-extrabold mb-2">لا تفوّت عروضنا القادمة</h3>
            <p className="opacity-90 mb-5">اشترك واحصل على آخر الأخبار من {store.name}</p>
            {newsletterState === "done" ? (
              <p className="font-bold">✓ تم الاشتراك بنجاح</p>
            ) : (
              <form onSubmit={onNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني"
                  className="flex-1 rounded-xl px-4 py-3 text-harbor font-bold"
                />
                <button
                  type="submit"
                  disabled={newsletterState === "loading"}
                  className="rounded-xl bg-white px-6 py-3 font-extrabold disabled:opacity-60 hover:opacity-90 transition-opacity"
                  style={{ color: primary }}
                >
                  {newsletterState === "loading" ? "..." : "اشترك"}
                </button>
              </form>
            )}
            {newsletterState === "error" && <p className="text-sm mt-2 opacity-90">تعذّر الاشتراك، حاول مجددًا</p>}
          </div>
        )}
      </main>
    </div>
  );
}
