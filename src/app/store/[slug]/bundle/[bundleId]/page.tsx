"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, formatLYD, type Bundle, type Product, type Store } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";

export default function BundleDetailPage() {
  const params = useParams<{ slug: string; bundleId: string }>();
  const slug = params.slug;
  const bundleId = params.bundleId;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [upsells, setUpsells] = useState<{ triggerProductId: string; offeredProductId: string }[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const cart = useCart(slug);

  useEffect(() => {
    api
      .publicStore(slug)
      .then(({ store, bundles, products, upsells }) => {
        setStore(store);
        setProducts(products);
        setUpsells(upsells);
        const found = bundles.find((b) => b.id === bundleId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setBundle(found);
      })
      .catch(() => setNotFound(true));
  }, [slug, bundleId]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">هذه الباقة غير موجودة</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  if (!store || !bundle) return null;

  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f0f0f0";
  const componentsValueCents = bundle.items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
  const savingsCents = componentsValueCents - bundle.priceCents;

  function handleAddToCart() {
    if (!bundle) return;
    cart.addBundle(bundle, 1);
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href={`/store/${slug}`} className="text-sm text-rope hover:text-harbor">
          ← العودة إلى المتجر
        </Link>

        <div className="mt-6 grid md:grid-cols-2 gap-10">
          <div className="aspect-square rounded-2xl border border-harbor/10 bg-harbor/5 overflow-hidden flex items-center justify-center">
            {bundle.imageUrl ? (
              <Image src={bundle.imageUrl} alt={bundle.name} width={800} height={800} unoptimized className="h-full w-full object-cover" />
            ) : (
              <span className="text-rope text-sm">لا توجد صورة</span>
            )}
          </div>

          <div>
            <span className="inline-block rounded-full bg-harbor/10 px-3 py-1 text-xs font-bold text-harbor mb-2">باقة</span>
            <h1 className="font-display text-2xl font-extrabold text-harbor">{bundle.name}</h1>
            <p className="font-bold text-xl mt-4" style={{ color: primary }}>
              {formatLYD(bundle.priceCents)}
            </p>
            {savingsCents > 0 && (
              <p className="text-sm text-green-700 mt-1">وفّر {formatLYD(savingsCents)} عند شراء هذه الباقة مجمّعة</p>
            )}

            <div className="mt-6">
              <span className="block text-sm font-bold text-harbor mb-2">تحتوي هذه الباقة على</span>
              <ul className="space-y-2">
                {bundle.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-xl border border-harbor/10 bg-white/50 px-4 py-2.5 text-sm">
                    <span className="text-harbor">{item.product.name}</span>
                    <span className="text-rope">× {item.quantity}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={handleAddToCart}
              style={{ backgroundColor: primary }}
              className="mt-6 rounded-full text-white py-3 px-8 font-bold hover:opacity-90 transition-opacity"
            >
              أضف الباقة للسلة
            </button>
          </div>
        </div>
      </main>

      <SiteFooter
        store={
          store.customization?.footerStyle === "branded"
            ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo }
            : undefined
        }
      />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        storeSlug={slug}
        lines={cart.lines}
        subtotalCents={cart.subtotalCents}
        setQuantity={cart.setQuantity}
        products={products}
        upsells={upsells}
        onAddToCart={(p) => cart.add(p)}
        theme={{
          primaryColor: store?.customization?.primaryColor || "#0066cc",
          secondaryColor: store?.customization?.secondaryColor || "#f0f0f0",
          accentColor: store?.customization?.accentColor,
        }}
      />
    </div>
  );
}
