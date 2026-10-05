"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Bundle, type Category, type Product, type Store, type StoreStats, type StoreTestimonial } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { captureReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/track-event";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { STOREFRONT_TEMPLATES } from "@/components/storefront/templates/registry";
import ModernTemplate from "@/components/storefront/templates/ModernTemplate";
import { isSupportedLanguage } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [upsells, setUpsells] = useState<{ triggerProductId: string; offeredProductId: string }[]>([]);
  const [navMenuItems, setNavMenuItems] = useState<{ id: string; label: string; url: string }[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const cart = useCart(slug);
  const language = store && isSupportedLanguage(store.language) ? store.language : "ar";
  const { t } = useTranslation(language);

  useEffect(() => captureReferralCode(slug), [slug]);
  useEffect(() => trackEvent(slug, "pageview", `/store/${slug}`), [slug]);

  useEffect(() => {
    api
      .publicStore(slug)
      .then(({ store, products, categories, bundles, upsells, navMenuItems, stats, testimonials }) => {
        setStore(store);
        setProducts(products);
        setCategories(categories);
        setBundles(bundles);
        setUpsells(upsells);
        setNavMenuItems(navMenuItems);
        setStats(stats);
        setTestimonials(testimonials);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

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
        <h1 className="font-display text-2xl font-bold text-harbor">{t("store.notFoundHeading")}</h1>
        <p className="text-rope mt-2">{t("store.notFoundSubtext")}</p>
      </main>
    );
  }

  if (!store) return null;

  const filtered = products.filter((p) => p.name.includes(query) && (!selectedCategoryId || p.categoryId === selectedCategoryId));
  const footerBranded = store.customization?.footerStyle === "branded";
  const Template = STOREFRONT_TEMPLATES[store.customization?.template?.slug ?? "modern"] ?? ModernTemplate;

  return (
    <>
      <Template
        slug={slug}
        store={store}
        products={products}
        filtered={filtered}
        query={query}
        setQuery={setQuery}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        setSelectedCategoryId={setSelectedCategoryId}
        bundles={bundles}
        navMenuItems={navMenuItems}
        stats={stats}
        testimonials={testimonials}
        cartTotalItems={cart.totalItems}
        onOpenCart={() => setCartOpen(true)}
        onAddToCart={(product) => {
          cart.add(product);
          setCartOpen(true);
        }}
        onAddBundleToCart={(bundle) => {
          cart.addBundle(bundle);
          setCartOpen(true);
        }}
        newsletterEmail={newsletterEmail}
        setNewsletterEmail={setNewsletterEmail}
        newsletterState={newsletterState}
        onNewsletterSubmit={handleNewsletterSubmit}
        sections={store.sections ?? []}
      />

      <SiteFooter store={footerBranded ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo } : undefined} language={language} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug={slug}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        setQuantity={cart.setQuantity}
        products={products}
        upsells={upsells}
        onAddToCart={(product) => cart.add(product)}
        language={language}
        theme={{
          // Same fallback the Modern template itself uses when a store has
          // no customization row at all (this store's own header/buttons
          // are already that blue) — matching it here, not the platform's
          // own harbor/signal colors, so the drawer always echoes whatever
          // the storefront around it is actually showing.
          primaryColor: store.customization?.primaryColor || "#0066cc",
          secondaryColor: store.customization?.secondaryColor || "#f0f0f0",
          accentColor: store.customization?.accentColor,
        }}
      />
    </>
  );
}
