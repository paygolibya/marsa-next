"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type Product, type Store, type StoreStats, type StoreTestimonial } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { STOREFRONT_TEMPLATES } from "@/components/storefront/templates/registry";
import ModernTemplate from "@/components/storefront/templates/ModernTemplate";

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

  // A store's own favicon (if uploaded). Previously mutated the existing
  // <link rel="icon">'s href in place — most browsers only read a
  // favicon's href at initial parse time and ignore a later JS mutation
  // to the SAME element, so the change never actually showed in the tab.
  // Removing Next's own default icon link(s) (from the app/icon.png file
  // convention) and inserting a brand-new element is the reliable
  // cross-browser way to swap it at runtime.
  useEffect(() => {
    const favicon = store?.customization?.favicon;
    if (!favicon) return;
    document.querySelectorAll<HTMLLinkElement>("link[rel~='icon']").forEach((el) => el.remove());
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = favicon;
    document.head.appendChild(link);
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
        sections={store.sections ?? []}
      />

      <SiteFooter store={footerBranded ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo } : undefined} />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug={slug}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        setQuantity={cart.setQuantity}
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
