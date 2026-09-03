import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { StorefrontTemplateProps } from "./types";

/**
 * "السوق" (Marketplace) — denser than the other three on purpose: a
 * compact single-row header with search built in (not a separate block),
 * a 4-column grid on desktop instead of 3, smaller cards with a rating
 * badge overlaid on the image, and stats shown as inline text rather than
 * pills or a banner — the "browse a lot, fast" feel of a marketplace
 * rather than a boutique storefront.
 */
export default function MarketplaceTemplate({
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
  const secondary = store.customization?.secondaryColor || "#f8fafc";
  const accent = store.customization?.accentColor || primary;

  return (
    <div style={{ backgroundColor: secondary }} className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white border-b border-harbor/10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            {store.customization?.logo && (
              <Image src={store.customization.logo} alt={store.name} width={32} height={32} unoptimized className="h-8 w-8 rounded object-cover" />
            )}
            <span className="font-display font-extrabold text-harbor whitespace-nowrap">{store.name}</span>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث في المتجر..."
            className="input flex-1 !py-2"
          />
          <button
            onClick={onOpenCart}
            style={{ backgroundColor: primary }}
            className="relative rounded-lg px-4 py-2 text-white font-bold text-sm shrink-0 hover:opacity-90 transition-opacity"
          >
            السلة
            {cartTotalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 flex items-center gap-2 text-xs">
          <span className="rounded-full px-3 py-1 font-bold text-white" style={{ backgroundColor: accent }}>
            الكل
          </span>
          {store.customization?.showSocialProof !== false && stats && (
            <span className="text-rope">
              {stats.deliveredOrderCount > 0 && `+${stats.deliveredOrderCount} طلب مُسلَّم`}
              {stats.averageRating != null && stats.reviewCount > 0 && ` · ★ ${stats.averageRating.toFixed(1)} (${stats.reviewCount})`}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {store.customization?.tagline && <p className="text-harbor/70 text-sm mb-6">{store.customization.tagline}</p>}

        {filtered.length === 0 ? (
          <p className="text-rope text-center py-16">لا توجد منتجات مطابقة حاليًا.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="rounded-lg border border-harbor/10 bg-white overflow-hidden flex flex-col">
                <Link href={`/store/${slug}/product/${product.id}`} className="relative aspect-square bg-harbor/5 flex items-center justify-center text-rope text-xs">
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} width={600} height={600} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    "لا توجد صورة"
                  )}
                  {stats?.averageRating != null && stats.reviewCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 text-white text-[10px] font-bold px-1.5 py-0.5">
                      ★ {stats.averageRating.toFixed(1)}
                    </span>
                  )}
                </Link>
                <div className="p-2.5 flex flex-col flex-1">
                  <Link href={`/store/${slug}/product/${product.id}`} className="text-sm font-bold text-harbor hover:underline line-clamp-2">
                    {product.name}
                  </Link>
                  <p className="font-extrabold text-sm mt-1" style={{ color: primary }}>
                    {formatLYD(product.priceCents)}
                  </p>
                  {product.variantOptions?.length ? (
                    <Link
                      href={`/store/${slug}/product/${product.id}`}
                      style={{ backgroundColor: primary }}
                      className="mt-2 rounded text-white py-1.5 text-xs font-bold text-center hover:opacity-90 transition-opacity"
                    >
                      اختر الخيارات
                    </Link>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      style={{ backgroundColor: primary }}
                      className="mt-2 rounded text-white py-1.5 text-xs font-bold hover:opacity-90 transition-opacity"
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
          <div className="mt-14">
            <h2 className="font-display text-lg font-extrabold text-harbor mb-4">آراء المشترين</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {testimonials.map((t, i) => (
                <div key={i} className="rounded-lg border border-harbor/10 bg-white p-3">
                  <p className="text-xs mb-1" style={{ color: accent }}>
                    {"★".repeat(t.rating)}
                    {"☆".repeat(5 - t.rating)}
                  </p>
                  {t.reviewText && <p className="text-xs text-harbor/80 mb-2 line-clamp-3">&quot;{t.reviewText}&quot;</p>}
                  <p className="text-[10px] text-rope">
                    {t.buyerName} — {t.productName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.customization?.showNewsletter && (
          <div className="mt-14 rounded-lg border border-harbor/10 bg-white p-6 text-center max-w-md mx-auto">
            <h3 className="font-bold text-harbor mb-1 text-sm">اشترك ليصلك كل جديد</h3>
            <p className="text-xs text-rope mb-3">عروض ومنتجات جديدة من {store.name}</p>
            {newsletterState === "done" ? (
              <p className="text-xs font-bold text-green-700">✓ تم الاشتراك بنجاح</p>
            ) : (
              <form onSubmit={onNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني"
                  className="input flex-1 !py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={newsletterState === "loading"}
                  style={{ backgroundColor: primary }}
                  className="rounded-lg px-4 py-2 font-bold text-white text-xs disabled:opacity-60 hover:opacity-90 transition-opacity"
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
