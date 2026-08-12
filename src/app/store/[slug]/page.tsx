"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, formatLYD, type Product, type Store } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";

export default function StorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useCart(slug);

  useEffect(() => {
    api
      .publicStore(slug)
      .then(({ store, products }) => {
        setStore(store);
        setProducts(products);
      })
      .catch(() => setNotFound(true));
  }, [slug]);

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

  return (
    <>
      <div style={{ backgroundColor: secondary }} className="min-h-screen">
        <header className="sticky top-0 z-30 backdrop-blur" style={{ backgroundColor: primary }}>
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
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
            <p className="text-harbor/80 mb-8 max-w-2xl">{store.customization.description}</p>
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
        </main>
      </div>

      <SiteFooter />

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
