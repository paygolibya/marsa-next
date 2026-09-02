"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, formatLYD, type Product, type Store, type StoreStats, type StoreTestimonial } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const cart = useCart(slug);

  useEffect(() => {
    api
      .publicStore(slug)
      .then(({ store, products, stats, testimonials }) => {
        setStore(store);
        setProducts(products);
        setStats(stats);
        setTestimonials(testimonials);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  // A store's own favicon (if uploaded) — previously captured in the
  // customizer and saved to the DB, but never actually applied anywhere.
  useEffect(() => {
    const favicon = store?.customization?.favicon;
    if (!favicon) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [store?.customization?.favicon]);

  async function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterState("loading");
    try {
      await api.subscribeNewsletter(slug, newsletterEmail.trim());
      setNewsletterState("done");
      setNewsletterEmail("");
    } catch {
      setNewsletterState("error");
    }
  }

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">هذا المتجر غير موجود</h1>
        <p className="text-rope mt-2">تأكد من الرابط وحاول مجددًا.</p>
      </main>
    );
  }

  if (!store) return null;

  const filtered = products.filter((p) => p.name.includes(query));

  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f0f0f0";
  const accent = store.customization?.accentColor || primary;
  const headerCentered = store.customization?.headerStyle === "centered";
  const footerBranded = store.customization?.footerStyle === "branded";

  return (
    <>
      <div style={{ backgroundColor: secondary }} className="min-h-screen">
        <header className="sticky top-0 z-30 backdrop-blur" style={{ backgroundColor: primary }}>
          <div className={`mx-auto max-w-6xl px-6 py-4 flex items-center gap-4 ${headerCentered ? "flex-col justify-center text-center" : "justify-between"}`}>
            <div className={`flex items-center gap-3 ${headerCentered ? "flex-col" : ""}`}>
              {store.customization?.logo && (
                <Image
                  src={store.customization.logo}
                  alt={store.name}
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <div>
                <h1 className="font-display text-xl font-extrabold text-white">{store.name}</h1>
                {store.customization?.tagline && (
                  <p className="text-sm text-white/80">{store.customization.tagline}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setCartOpen(true)}
              className="relative rounded-full bg-white/15 px-5 py-2 text-white font-bold text-sm hover:bg-white/25 transition-colors"
            >
              سلة التسوق
              {cart.totalItems > 0 && (
                <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center text-white">
                  {cart.totalItems}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">
          {store.customization?.description && (
            <p className="text-harbor/80 mb-6 max-w-2xl">{store.customization.description}</p>
          )}

          {/* Social proof — real numbers (delivered order count, average
              rating), not decorative filler. Only rendered when there's
              something real to show, and when the merchant opted in. */}
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

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="input mb-8 max-w-sm"
          />

          {filtered.length === 0 ? (
            <p className="text-rope text-center py-16">لا توجد منتجات مطابقة حاليًا.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((product) => (
                <div key={product.id} className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col">
                  <Link href={`/store/${slug}/product/${product.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={800}
                        height={800}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
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
                      onClick={() => {
                        cart.add(product);
                        setCartOpen(true);
                      }}
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

          {/* Testimonials — real 4★+ reviews left on this store's own
              products, not invented copy. */}
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

          {/* Newsletter — a real capture (/api/newsletter/subscribe), not
              a decorative form. */}
          {store.customization?.showNewsletter && (
            <div className="mt-16 rounded-2xl border border-dashed border-harbor/20 p-8 text-center max-w-lg mx-auto">
              <h3 className="font-display font-bold text-harbor mb-2">اشترك ليصلك كل جديد</h3>
              <p className="text-sm text-rope mb-4">عروض ومنتجات جديدة من {store.name}</p>
              {newsletterState === "done" ? (
                <p className="text-sm font-bold text-green-700">✓ تم الاشتراك بنجاح</p>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
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

      <SiteFooter store={footerBranded ? { name: store.name, tagline: store.customization?.tagline } : undefined} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug={slug}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        setQuantity={cart.setQuantity}
      />
    </>
  );
}
