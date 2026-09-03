import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { StorefrontTemplateProps } from "./types";

/**
 * "الفاخر" (Luxury) — the one template that inverts the usual primary/
 * secondary roles on purpose: primaryColor is the dark canvas itself
 * (default #1f2937), secondaryColor/accentColor is the gold highlight
 * (default #f59e0b) — that's what actually reads as "luxury," not a
 * light page with a dark header. Centered nav, generous whitespace, a
 * refined 2-column grid instead of 3, thin gold-on-dark borders.
 */
export default function LuxuryTemplate({
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
  const dark = store.customization?.primaryColor || "#1f2937";
  const gold = store.customization?.accentColor || store.customization?.secondaryColor || "#f59e0b";

  return (
    <div style={{ backgroundColor: dark }} className="min-h-screen text-white">
      <header className="border-b" style={{ borderColor: `${gold}30` }}>
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col items-center text-center gap-3">
          {store.customization?.logo && (
            <Image src={store.customization.logo} alt={store.name} width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover" style={{ border: `1px solid ${gold}` }} />
          )}
          <h1 className="font-display text-3xl font-extrabold tracking-wide" style={{ color: gold }}>
            {store.name}
          </h1>
          {store.customization?.tagline && <p className="text-white/60 text-sm tracking-wide">{store.customization.tagline}</p>}
          <button
            onClick={onOpenCart}
            className="relative mt-2 rounded-full border px-6 py-2 text-sm font-bold tracking-wide hover:bg-white/5 transition-colors"
            style={{ borderColor: gold, color: gold }}
          >
            سلة التسوق
            {cartTotalItems > 0 && (
              <span
                className="absolute -top-2 -left-2 h-5 w-5 rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ backgroundColor: gold, color: dark }}
              >
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        {store.customization?.description && <p className="text-white/70 text-center max-w-xl mx-auto mb-10">{store.customization.description}</p>}

        {store.customization?.showSocialProof !== false && stats && (stats.deliveredOrderCount > 0 || stats.reviewCount > 0) && (
          <div className="flex flex-wrap justify-center gap-8 mb-12 text-center">
            {stats.deliveredOrderCount > 0 && (
              <div>
                <p className="font-display text-xl font-extrabold" style={{ color: gold }}>
                  +{stats.deliveredOrderCount}
                </p>
                <p className="text-xs text-white/50 tracking-wide">طلب تم تسليمه</p>
              </div>
            )}
            {stats.averageRating != null && stats.reviewCount > 0 && (
              <div>
                <p className="font-display text-xl font-extrabold" style={{ color: gold }}>
                  ★ {stats.averageRating.toFixed(1)}
                </p>
                <p className="text-xs text-white/50 tracking-wide">{stats.reviewCount} تقييم</p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center mb-12">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="w-full max-w-sm rounded-none border-0 border-b bg-transparent px-2 py-2 text-center text-white placeholder:text-white/40 focus:outline-none"
            style={{ borderColor: `${gold}50` }}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-white/50 text-center py-16">لا توجد منتجات مطابقة حاليًا.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-10">
            {filtered.map((product) => (
              <div key={product.id} className="flex flex-col">
                <Link
                  href={`/store/${slug}/product/${product.id}`}
                  className="aspect-[4/3] flex items-center justify-center text-white/40 text-sm border"
                  style={{ borderColor: `${gold}30` }}
                >
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} alt={product.name} width={900} height={675} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    "لا توجد صورة"
                  )}
                </Link>
                <div className="pt-4 text-center">
                  <Link href={`/store/${slug}/product/${product.id}`} className="font-display text-lg font-bold hover:underline">
                    {product.name}
                  </Link>
                  <p className="mt-1 font-bold tracking-wide" style={{ color: gold }}>
                    {formatLYD(product.priceCents)}
                  </p>
                  <button
                    onClick={() => onAddToCart(product)}
                    className="mt-3 rounded-full border px-6 py-2 text-xs font-bold tracking-widest hover:bg-white/5 transition-colors"
                    style={{ borderColor: gold, color: gold }}
                  >
                    أضف إلى السلة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {store.customization?.showTestimonials && testimonials.length > 0 && (
          <div className="mt-24 text-center">
            <h2 className="font-display text-xl font-extrabold mb-10 tracking-wide" style={{ color: gold }}>
              آراء عملائنا
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {testimonials.map((t, i) => (
                <div key={i}>
                  <p className="mb-3" style={{ color: gold }}>
                    {"★".repeat(t.rating)}
                    {"☆".repeat(5 - t.rating)}
                  </p>
                  {t.reviewText && <p className="text-sm text-white/70 mb-3">&quot;{t.reviewText}&quot;</p>}
                  <p className="text-xs text-white/40 tracking-wide">
                    {t.buyerName} — {t.productName}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {store.customization?.showNewsletter && (
          <div className="mt-24 text-center max-w-md mx-auto">
            <h3 className="font-display font-bold mb-2 tracking-wide" style={{ color: gold }}>
              انضم إلى قائمتنا الخاصة
            </h3>
            <p className="text-sm text-white/60 mb-5">عروض حصرية من {store.name}</p>
            {newsletterState === "done" ? (
              <p className="text-sm font-bold" style={{ color: gold }}>
                ✓ تم الاشتراك بنجاح
              </p>
            ) : (
              <form onSubmit={onNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني"
                  className="flex-1 rounded-none border-0 border-b bg-transparent px-2 py-2 text-white placeholder:text-white/40 focus:outline-none"
                  style={{ borderColor: `${gold}50` }}
                />
                <button
                  type="submit"
                  disabled={newsletterState === "loading"}
                  className="rounded-full border px-6 py-2 text-xs font-bold tracking-widest disabled:opacity-50 hover:bg-white/5 transition-colors"
                  style={{ borderColor: gold, color: gold }}
                >
                  {newsletterState === "loading" ? "..." : "اشترك"}
                </button>
              </form>
            )}
            {newsletterState === "error" && <p className="text-xs mt-2 text-white/50">تعذّر الاشتراك، حاول مجددًا</p>}
          </div>
        )}
      </main>
    </div>
  );
}
