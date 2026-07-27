"use client";

import Image from "next/image";
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

  return (
    <>
      <header className="border-b border-harbor/10 bg-canvas/95 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <h1 className="font-display text-xl font-extrabold text-harbor">{store.name}</h1>
          <button
            onClick={() => setCartOpen(true)}
            className="relative rounded-full bg-harbor px-5 py-2 text-canvas font-bold text-sm hover:bg-harbor-deep transition-colors"
          >
            سلة التسوق
            {cart.totalItems > 0 && (
              <span className="absolute -top-2 -left-2 h-5 w-5 rounded-full bg-signal text-[11px] flex items-center justify-center">
                {cart.totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
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
              <div key={product.id} className="rounded-2xl border border-harbor/10 bg-white/50 overflow-hidden flex flex-col">
                <div className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm">
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
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-harbor">{product.name}</h3>
                  <p className="text-brass font-bold mt-1">{formatLYD(product.priceCents)}</p>
                  <button
                    onClick={() => {
                      cart.add(product);
                      setCartOpen(true);
                    }}
                    className="mt-4 rounded-full bg-harbor text-canvas py-2 font-bold text-sm hover:bg-harbor-deep transition-colors"
                  >
                    أضف إلى السلة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
