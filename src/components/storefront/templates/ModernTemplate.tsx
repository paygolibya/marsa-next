import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { StorefrontTemplateProps } from "./types";

/**
 * "الحديث" (Modern) — the baseline template: clean grid, standard header,
 * no strong visual opinion beyond the merchant's own colors. Extracted
 * as-is from what was previously the only storefront layout — every
 * other template deliberately breaks from this structure, not just its
 * colors.
 */
export default function ModernTemplate({
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
  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f0f0f0";
  const accent = store.customization?.accentColor || primary;
  const headerCentered = store.customization?.headerStyle === "centered";

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      <header className="sticky top-0 z-30 backdrop-blur" style={{ backgroundColor: primary }}>
        <div className={`mx-auto max-w-6xl px-6 py-4 flex items-center gap-4 ${headerCentered ? "flex-col justify-center text-center" : "justify-between"}`}>
          <div className={`flex items-center gap-3 ${headerCentered ? "flex-col" : ""}`}>
            {store.customization?.logo && (
              <Image src={store.customization.logo} alt={store.name} width={40} height={40} unoptimized className="h-10 w-10 rounded-full object-cover" />
            )}
            <div>
              <h1 className="font-display text-xl font-extrabold text-white">{store.name}</h1>
              {store.customization?.tagline && <p className="text-sm text-white/80">{store.customization.tagline}</p>}
            </div>
          </div>
          <button onClick={onOpenCart} className="relative rounded-full bg-white/15 px-5 py-2 text-white font-bold text-sm hover:bg-white/25 transition-colors">
            سلة التسوق
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {store.customization?.description && <p className="text-harbor/80 mb-6 max-w-2xl">{store.customization.description}</p>}

        {store.customization?.showSocialProof !== false && stats && (stats.deliveredOrderCount > 0 || stats.reviewCount > 0) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {stats.deliveredOrderCount > 0 && (
              <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold border border-harbor/10" style={{ color: accent }}>
                +{stats.deliveredOrderCount} طلب تم تسليمه
              </span>
            )}
            {stats.averageRating != null && stats.reviewCount > 0 && (
              <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold border border-harbor/10" style={{ color: accent }}>
                ★ {stats.averageRating.toFixed(1)} ({stats.reviewCount} تقييم)
              </span>
            )}
          </div>
        )}

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن منتج..." className="input mb-8 max-w-sm" />

        {filtered.length === 0 ? (
          <p className="text-rope text-center py-16">لا توجد منتجات مطابقة حاليًا.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col">
                <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} width={800} height={800} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    "لا توجد صورة"
                  )}
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-bold text-harbor hover:underline">
                    {product.name}
                  </Link>
                  <p className="font-bold mt-1" style={{ color: primary }}>
                    {formatLYD(product.priceCents)}
                  </p>
                  <button
                    onClick={() => onAddToCart(product)}
                    style={{ backgroundColor: primary }}
                    className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    أضف إلى السلة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {store.customization?.showTestimonials && testimonials.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-xl font-extrabold text-harbor mb-6">آراء عملائنا</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-2xl border border-harbor/10 bg-white p-5">
                  <p className="font-bold mb-2" style={{ color: accent }}>
                    {"★".repeat(t.rating)}
                    {"☆".repeat(5 - t.rating)}
                  </p>
                  {t.reviewText && <p className="text-sm text-harbor/80 mb-3">&quot;{t.reviewText}&quot;</p>}
                  <p className="text-xs text-rope">
                    {t.buyerName} — {t.productName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.customization?.showNewsletter && (
          <div className="mt-16 rounded-2xl border border-dashed border-harbor/20 p-8 text-center max-w-lg mx-auto">
            <h3 className="font-display font-bold text-harbor mb-2">اشترك ليصلك كل جديد</h3>
            <p className="text-sm text-rope mb-4">عروض ومنتجات جديدة من {store.name}</p>
            {newsletterState === "done" ? (
              <p className="text-sm font-bold text-green-700">✓ تم الاشتراك بنجاح</p>
            ) : (
              <form onSubmit={onNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني"
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={newsletterState === "loading"}
                  style={{ backgroundColor: primary }}
                  className="rounded-full px-6 py-2.5 font-bold text-white text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
                >
                  {newsletterState === "loading" ? "..." : "اشترك"}
                </button>
              </form>
            )}
            {newsletterState === "error" && <p className="text-signal text-xs mt-2">تعذّر الاشتراك، حاول مجددًا</p>}
          </div>
        )}
      </main>
    </div>
  );
}
