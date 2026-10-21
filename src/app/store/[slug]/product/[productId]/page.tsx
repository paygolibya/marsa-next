"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import Link from "next/link";
import { api, ApiError, formatLYD, type Product, type ProductReview, type Store } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { captureReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/track-event";
import { initAdPixels } from "@/lib/ad-pixels";
import { CartDrawer } from "@/components/cart-drawer";
import { SiteFooter } from "@/components/site-footer";
import { InquiryModal } from "@/components/storefront/InquiryModal";
import { StorefrontLoadError, StorefrontSkeleton, StorePausedNotice } from "@/components/storefront/StorefrontSkeleton";
import { Icon, Stars, type IconName } from "@/components/ui/Icon";
import { isSupportedLanguage, resolveProductTranslation, translate, type Language } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDecodedParams } from "@/lib/use-decoded-params";

export default function ProductDetailPage() {
  const params = useDecodedParams<{ slug: string; productId: string }>();
  const slug = params.slug;
  const productId = params.productId;

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [upsells, setUpsells] = useState<{ triggerProductId: string; offeredProductId: string }[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [average, setAverage] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [inquiryOpen, setInquiryOpen] = useState(false);

  const cart = useCart(slug);
  const language = store && isSupportedLanguage(store.language) ? store.language : "ar";
  const { t } = useTranslation(language);

  useEffect(() => captureReferralCode(slug), [slug]);
  useEffect(() => trackEvent(slug, "pageview", `/store/${slug}/product/${productId}`), [slug, productId]);

  useEffect(() => {
    setLoadError(false);
    api
      .publicStore(slug)
      .then(({ store, products, upsells }) => {
        initAdPixels(store);
        setStore(store);
        setProducts(products);
        setUpsells(upsells);
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
      .catch((err) => {
        if (err instanceof ApiError && err.status === 423) setPaused(true);
        else if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setLoadError(true);
      });
  }, [slug, productId, attempt]);

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

  if (paused) return <StorePausedNotice heading={t("store.pausedHeading")} subtext={t("store.pausedSubtext")} />;

  if (notFound) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">{t("product.notFoundHeading")}</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          {t("common.backToStore")}
        </Link>
      </main>
    );
  }

  if (loadError && !product) {
    return (
      <StorefrontLoadError
        heading={t("store.loadErrorHeading")}
        subtext={t("store.loadErrorSubtext")}
        retryLabel={t("common.retry")}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (!store || !product) return <StorefrontSkeleton variant="product" label={t("common.loading")} />;

  const primary = store.customization?.primaryColor || "#0066cc";
  const secondary = store.customization?.secondaryColor || "#f0f0f0";
  const activeImageUrl = gallery[activeImage] ?? gallery[0];
  const resolved = resolveProductTranslation(product, language);

  const cartCount = cart.lines.reduce((sum, l) => sum + l.quantity, 0);
  const trustChips: { icon: IconName; label: string }[] = [];
  if (store.codEnabled) trustChips.push({ icon: "wallet", label: t("product.trustCod") });
  if (store.walletProvider && store.dpayAvailable) trustChips.push({ icon: "card", label: t("product.trustCard") });
  if (store.type === "physical") {
    trustChips.push({ icon: "truck", label: t("product.trustDelivery") });
    trustChips.push({ icon: "clock", label: t("product.trustTripoli") });
  }

  function handleAddToCart() {
    if (!product || outOfStock) return;
    cart.add(
      product,
      1,
      selectedVariant
        ? {
            id: selectedVariant.id,
            label: Object.entries(selectedVariant.options)
              .map(([k, v]) => `${k}: ${v}`)
              .join(language === "en" ? ", " : "، "),
            priceCents: effectivePriceCents,
          }
        : null
    );
    setCartOpen(true);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      {/* pb-28 on phones leaves room for the sticky buy bar below. */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 pb-28 md:py-12">
        {/* Store › product breadcrumb + cart (structure from 21st.dev's
            Product Detail Page) — the page used to have only a bare
            "back to store" link and no way to reach the cart. */}
        <div className="flex items-center justify-between gap-3">
          <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-rope">
            <Link href={`/store/${slug}`} className="shrink-0 font-bold text-harbor hover:underline">
              {store.name}
            </Link>
            <span aria-hidden>›</span>
            <span className="truncate">{resolved.name}</span>
          </nav>
          {store.type !== "showcase" && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 shrink-0 items-center gap-2 rounded-full border border-harbor/15 bg-white px-4 text-sm font-bold text-harbor hover:bg-harbor/5 transition-colors"
            >
              <Icon name="cart" size={18} />
              {t("cart.titleShort")}
              {cartCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] text-white" style={{ backgroundColor: primary }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="mt-6 grid md:grid-cols-2 gap-10">
          <div>
            <div className="aspect-square rounded-2xl border border-harbor/10 bg-harbor/5 overflow-hidden flex items-center justify-center">
              {activeImageUrl ? (
                <Image src={activeImageUrl} alt={resolved.name} width={800} height={800} unoptimized className="h-full w-full object-cover" />
              ) : (
                <span className="text-rope text-sm">{t("common.noImage")}</span>
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
            <h1 className="font-display text-2xl font-extrabold text-harbor">{resolved.name}</h1>
            {reviews.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-rope mt-1">
                <span className="text-brass">
                  <Stars rating={average} />
                </span>
                {t("stats.reviewsSuffix", { count: reviews.length })}
              </p>
            )}
            <p className="font-display font-extrabold text-3xl mt-3" style={{ color: primary }}>
              {formatLYD(effectivePriceCents, language)}
              {store?.type === "rental" && <span className="text-base font-normal text-rope">{t("common.perDay")}</span>}
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

            {store.type === "showcase" ? (
              <button
                onClick={() => setInquiryOpen(true)}
                style={{ backgroundColor: primary }}
                className="mt-6 rounded-full text-white py-3 px-8 font-bold hover:opacity-90 transition-opacity"
              >
                {t("product.inquireAboutThis")}
              </button>
            ) : outOfStock ? (
              <p className="mt-6 text-signal font-bold">{hasVariants && !selectedVariant ? t("products.optionUnavailable") : t("products.outOfStock")}</p>
            ) : (
              <button
                onClick={handleAddToCart}
                style={{ backgroundColor: primary }}
                className="mt-6 rounded-full text-white py-3 px-8 font-bold hover:opacity-90 transition-opacity"
              >
                {t("common.addToCart")}
              </button>
            )}
            {!hasVariants && product.trackInventory && !outOfStock && product.stockQty <= product.lowStockThreshold && (
              <p className="mt-2 text-xs text-signal">{t("products.lowStock")}</p>
            )}
            {hasVariants && selectedVariant && !outOfStock && selectedVariant.stockQty <= 5 && (
              <p className="mt-2 text-xs text-signal">{t("products.lowStock")}</p>
            )}

            {/* Reassurance right where the buyer decides — only what is
                actually true for this store (payment methods it accepts;
                delivery only for stores that ship). */}
            {trustChips.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {trustChips.map((chip) => (
                  <li key={chip.label} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-harbor shadow-sm">
                    <Icon name={chip.icon} size={14} />
                    {chip.label}
                  </li>
                ))}
              </ul>
            )}

            {resolved.description && <p className="text-sm text-rope mt-6 whitespace-pre-line leading-relaxed">{resolved.description}</p>}

            <Link
              href={`/store/${slug}`}
              className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-harbor/10 bg-white p-4 hover:shadow-md transition-shadow"
            >
              <span className="flex min-w-0 items-center gap-3">
                {store.customization?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={store.customization.logo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-harbor/10 text-harbor">
                    <Icon name="store" size={18} />
                  </span>
                )}
                <span className="truncate font-bold text-harbor">{store.name}</span>
              </span>
              <span className="shrink-0 text-sm font-bold" style={{ color: primary }}>
                {t("product.allProducts")} ←
              </span>
            </Link>
          </div>
        </div>

        <ReviewsSection productId={productId} reviews={reviews} onSubmitted={refreshReviews} language={language} />
      </main>

      {/* Phones: price + the main action always on screen (the button
          used to sit below the description, past the first screen). Extra
          bottom padding clears iPhone Safari's floating toolbar. */}
      {store.type !== "showcase" && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-harbor/10 bg-white/95 backdrop-blur px-4 pt-3 pb-[max(1.5rem,calc(0.75rem+env(safe-area-inset-bottom)))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-display text-lg font-extrabold" style={{ color: primary }}>
              {formatLYD(effectivePriceCents, language)}
            </span>
            {outOfStock ? (
              <span className="flex-1 text-center text-sm font-bold text-signal">
                {hasVariants && !selectedVariant ? t("products.optionUnavailable") : t("products.outOfStock")}
              </span>
            ) : (
              <button
                onClick={handleAddToCart}
                style={{ backgroundColor: primary }}
                className="flex-1 min-h-[48px] rounded-full font-bold text-white active:scale-[0.98] transition-transform"
              >
                {t("common.addToCart")}
              </button>
            )}
          </div>
        </div>
      )}

      <SiteFooter
        store={
          store.customization?.footerStyle === "branded"
            ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo }
            : undefined
        }
        language={language}
      />

      <InquiryModal open={inquiryOpen} onClose={() => setInquiryOpen(false)} storeSlug={slug} productId={product.id} productName={resolved.name} language={language} />

      {store.type !== "showcase" && (
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
          language={language}
          theme={{
            primaryColor: store?.customization?.primaryColor || "#0066cc",
            secondaryColor: store?.customization?.secondaryColor || "#f0f0f0",
            accentColor: store?.customization?.accentColor,
          }}
        />
      )}
    </div>
  );
}

function ReviewsSection({
  productId,
  reviews,
  onSubmitted,
  language,
}: {
  productId: string;
  reviews: ProductReview[];
  onSubmitted: () => void;
  language: Language;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
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
      setError(err instanceof ApiError ? err.message : t("product.reviewErrorFallback"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-16 border-t border-harbor/10 pt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-extrabold text-harbor">{t("product.reviewsHeading")}</h2>
        {!showForm && !success && (
          <button onClick={() => setShowForm(true)} className="text-sm font-bold text-brass hover:underline">
            {t("product.addReview")}
          </button>
        )}
      </div>

      {success && <p className="text-sm text-green-700 mb-4">{t("product.reviewSubmitted")}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-harbor/10 bg-white/50 p-5 space-y-3">
          <p className="text-xs text-rope">{t("product.reviewInstructions")}</p>
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder={t("product.orderIdPlaceholder")} dir="ltr" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input" />
            <input required placeholder={t("product.phonePlaceholder")} dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </div>
          <input required placeholder={t("product.namePlaceholder")} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="input" />
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="input">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {t("product.ratingOption", { stars: "★".repeat(n), n })}
              </option>
            ))}
          </select>
          <textarea placeholder={t("product.reviewTextPlaceholder")} value={reviewText} onChange={(e) => setReviewText(e.target.value)} className="input" rows={3} />
          {error && <p className="text-signal text-sm">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-signal px-5 py-2 text-sm font-bold text-canvas hover:bg-signal-dark disabled:opacity-60"
            >
              {saving ? t("product.submittingReview") : t("product.submitReview")}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-rope">
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-rope text-sm">{t("product.noReviews")}</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-harbor/10 bg-white/50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-harbor">{r.buyerName}</span>
                <span className="text-brass text-sm"><Stars rating={r.rating} /></span>
              </div>
              {r.reviewText && <p className="text-sm text-rope mt-2">{r.reviewText}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
