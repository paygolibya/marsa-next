"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Product, type ProductReview, type Store } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";

export default function ProductDetailPage() {
  const params = useParams<{ slug: string; productId: string }>();
  const slug = params.slug;
  const productId = params.productId;

  const [store, setStore] = useState<Store | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [average, setAverage] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const cart = useCart(slug);

  useEffect(() => {
    api
      .publicStore(slug)
      .then(({ store, products }) => {
        setStore(store);
        const found = products.find((p) => p.id === productId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setProduct(found);
        // Pre-select the first value of every option so a variant is
        // always resolvable without the buyer having to touch anything
        // for a single-combination product.
        if (found.variantOptions?.length) {
          setSelectedOptions(Object.fromEntries(found.variantOptions.map((o) => [o.name, o.values[0]])));
        }
      })
      .catch(() => setNotFound(true));
  }, [slug, productId]);

  // The variant matching whatever the buyer has currently picked — null
  // if this product has no variants, or the exact combination isn't
  // offered (shouldn't normally happen since every value comes from the
  // product's own option lists, but a variant can be individually
  // deleted by the merchant after being generated).
  const selectedVariant =
    product?.variantOptions?.length && product.variants.length > 0
      ? (product.variants.find((v) => Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val)) ?? null)
      : null;

  const gallery = product?.images?.length ? product.images : product?.imageUrl ? [product.imageUrl] : [];
  const effectivePriceCents = selectedVariant?.priceCents ?? product?.priceCents ?? 0;
  const hasVariants = Boolean(product?.variantOptions?.length);
  // Stock is tracked per-variant once a product has variants — the base
  // product's own stockQty is only meaningful for a plain product.
  const outOfStock = hasVariants
    ? selectedVariant
      ? selectedVariant.stockQty <= 0
      : true // no matching variant for the current selection — nothing to sell
    : Boolean(product?.trackInventory && product.stockQty <= 0);

  function refreshReviews() {
    api.productReviews(productId).then(({ reviews, average }) => {
      setReviews(reviews);
      setAverage(average);
    });
  }

  useEffect(refreshReviews, [productId]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">هذا المنتج غير موجود</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  if (!store || !product) return null;

  const primary = store.customization?.primaryColor || "#0066cc";
  const activeImageUrl = gallery[activeImage] ?? gallery[0];

  function handleAddToCart() {
    if (!product || outOfStock) return;
    cart.add(
      product,
      1,
      selectedVariant ? { id: selectedVariant.id, label: Object.entries(selectedVariant.options).map(([k, v]) => `${k}: ${v}`).join("، "), priceCents: effectivePriceCents } : null
    );
    setCartOpen(true);
  }

  return (
    <>
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href={`/store/${slug}`} className="text-sm text-rope hover:text-harbor">
          ← العودة إلى المتجر
        </Link>

        <div className="mt-6 grid md:grid-cols-2 gap-10">
          <div>
            <div className="aspect-square rounded-2xl border border-harbor/10 bg-harbor/5 overflow-hidden flex items-center justify-center">
              {activeImageUrl ? (
                <Image src={activeImageUrl} alt={product.name} width={800} height={800} unoptimized className="h-full w-full object-cover" />
              ) : (
                <span className="text-rope text-sm">لا توجد صورة</span>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="mt-3 flex gap-2">
                {gallery.map((url, i) => (
                  <button
                    key={url + i}
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-colors ${i === activeImage ? "border-brass" : "border-transparent"}`}
                  >
                    <Image src={url} alt="" width={100} height={100} unoptimized className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-display text-2xl font-extrabold text-harbor">{product.name}</h1>
            {reviews.length > 0 && (
              <p className="text-sm text-rope mt-1">
                {"★".repeat(Math.round(average))}
                {"☆".repeat(5 - Math.round(average))} ({reviews.length} تقييم)
              </p>
            )}
            <p className="font-bold text-2xl mt-4" style={{ color: primary }}>
              {formatLYD(effectivePriceCents)}
            </p>

            {product.variantOptions?.map((option) => (
              <div key={option.name} className="mt-5">
                <span className="block text-sm font-bold text-harbor mb-2">{option.name}</span>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const active = selectedOptions[option.name] === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))}
                        className="rounded-full border px-4 py-1.5 text-sm font-bold transition-colors"
                        style={active ? { backgroundColor: primary, color: "white", borderColor: primary } : { borderColor: "rgba(0,0,0,0.15)" }}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {outOfStock ? (
              <p className="mt-6 text-signal font-bold">{hasVariants && !selectedVariant ? "هذا الخيار غير متوفر" : "نفدت الكمية"}</p>
            ) : (
              <button
                onClick={handleAddToCart}
                style={{ backgroundColor: primary }}
                className="mt-6 rounded-full text-white py-3 px-8 font-bold hover:opacity-90 transition-opacity"
              >
                أضف إلى السلة
              </button>
            )}
            {!hasVariants && product.trackInventory && !outOfStock && product.stockQty <= product.lowStockThreshold && (
              <p className="mt-2 text-xs text-signal">كمية محدودة متبقية</p>
            )}
            {hasVariants && selectedVariant && !outOfStock && selectedVariant.stockQty <= 5 && (
              <p className="mt-2 text-xs text-signal">كمية محدودة متبقية</p>
            )}
          </div>
        </div>

        <ReviewsSection productId={productId} reviews={reviews} onSubmitted={refreshReviews} />
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

function ReviewsSection({
  productId,
  reviews,
  onSubmitted,
}: {
  productId: string;
  reviews: ProductReview[];
  onSubmitted: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.submitReview({ productId, orderId, phone, buyerName, rating, reviewText: reviewText || undefined });
      setSuccess(true);
      setShowForm(false);
      onSubmitted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إرسال التقييم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-16 border-t border-harbor/10 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-extrabold text-harbor">التقييمات</h2>
        {!showForm && !success && (
          <button onClick={() => setShowForm(true)} className="text-sm font-bold text-brass hover:underline">
            أضف تقييمًا
          </button>
        )}
      </div>

      {success && <p className="text-sm text-green-700 mb-4">✓ شكرًا لك، تم إرسال تقييمك</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-harbor/10 bg-white/50 p-5 space-y-3">
          <p className="text-xs text-rope">لإضافة تقييم، أدخل رقم الطلب ورقم الهاتف المستخدم عند الشراء.</p>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="رقم الطلب" dir="ltr" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input" />
            <input required placeholder="رقم الهاتف" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </div>
          <input required placeholder="اسمك" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="input" />
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} ({n})
              </option>
            ))}
          </select>
          <textarea placeholder="رأيك (اختياري)" value={reviewText} onChange={(e) => setReviewText(e.target.value)} className="input" rows={3} />
          {error && <p className="text-signal text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-canvas hover:bg-signal-dark disabled:opacity-60"
            >
              {saving ? "جارٍ الإرسال..." : "إرسال التقييم"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-rope">
              إلغاء
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-rope text-sm">لا توجد تقييمات بعد.</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-harbor/10 bg-white/50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-harbor">{r.buyerName}</span>
                <span className="text-brass text-sm">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              </div>
              {r.reviewText && <p className="text-sm text-rope mt-2">{r.reviewText}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
