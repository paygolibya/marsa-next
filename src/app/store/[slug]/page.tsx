"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Product, type Store, type StoreStats, type StoreTestimonial } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import ModernTemplate from "@/components/storefront/templates/ModernTemplate";
import BoldTemplate from "@/components/storefront/templates/BoldTemplate";
import LuxuryTemplate from "@/components/storefront/templates/LuxuryTemplate";
import MarketplaceTemplate from "@/components/storefront/templates/MarketplaceTemplate";
import type { StorefrontTemplateProps } from "@/components/storefront/templates/types";

// Each Template row's componentPath ("free/modern", "paid/luxury", ...)
// signals real per-template components were always the intent — this is
// that mapping actually existing. Previously every store rendered the
// identical layout regardless of which template was picked, just with
// different starting colors; two merchants paying for different
// "premium" templates got the same page. Falls back to Modern for a
// store with no template set at all (pre-template-system stores).
const TEMPLATES: Record<string, (props: StorefrontTemplateProps) => React.ReactElement> = {
  modern: ModernTemplate,
  bold: BoldTemplate,
  luxury: LuxuryTemplate,
  marketplace: MarketplaceTemplate,
};

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
  const footerBranded = store.customization?.footerStyle === "branded";
  const Template = TEMPLATES[store.customization?.template?.slug ?? "modern"] ?? ModernTemplate;

  return (
    <>
      <Template
        slug={slug}
        store={store}
        products={products}
        filtered={filtered}
        query={query}
        setQuery={setQuery}
        stats={stats}
        testimonials={testimonials}
        cartTotalItems={cart.totalItems}
        onOpenCart={() => setCartOpen(true)}
        onAddToCart={(product) => {
          cart.add(product);
          setCartOpen(true);
        }}
        newsletterEmail={newsletterEmail}
        setNewsletterEmail={setNewsletterEmail}
        newsletterState={newsletterState}
        onNewsletterSubmit={handleNewsletterSubmit}
      />

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
