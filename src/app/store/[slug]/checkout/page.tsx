"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store, type VanexCity } from "@/lib/api";
import { useCart } from "@/lib/use-cart";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
};

declare global {
  interface Window {
    Lightbox?: {
      Checkout: {
        configure: Record<string, unknown>;
        showLightbox: () => void;
        closeLightbox: () => void;
      };
    };
  }
}

// Loads Moamalat's LightBox widget script at most once per page — the
// script itself defines window.Lightbox, so a second injection would just
// redefine the same global.
let lightboxScriptPromise: Promise<void> | null = null;
function loadLightboxScript(src: string): Promise<void> {
  if (window.Lightbox) return Promise.resolve();
  if (!lightboxScriptPromise) {
    lightboxScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load lightbox.js"));
      document.body.appendChild(script);
    });
  }
  return lightboxScriptPromise;
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const cart = useCart(slug);

  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet">("cod");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // True while the Moamalat widget is open / being finalized — keeps the
  // submit button disabled without reusing `loading` (which also covers
  // the initial /api/orders call).
  const [walletPending, setWalletPending] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const usesVanexPricing = store?.courier === "vanex";
  const [vanexCities, setVanexCities] = useState<VanexCity[]>([]);
  const [vanexCityId, setVanexCityId] = useState("");
  const [vanexAreaId, setVanexAreaId] = useState("");

  // Cart/order details kept around so completeCallback (fired from inside
  // Moamalat's widget, well after the initial submit) can still build the
  // confirmation-page redirect.
  const pendingOrderRef = useRef<{ orderId: string; totalCents: number; shippingCents: number } | null>(null);

  useEffect(() => {
    api.publicStore(slug).then(({ store }) => {
      setStore(store);
      const walletAvailable = Boolean(store.walletProvider && store.dpayAvailable);
      setPaymentMethod(store.codEnabled ? "cod" : walletAvailable ? "wallet" : "cod");
    });
  }, [slug]);

  useEffect(() => {
    if (!usesVanexPricing) return;
    api.vanexCities().then(({ cities }) => setVanexCities(cities));
  }, [usesVanexPricing]);

  const walletAvailable = Boolean(store?.walletProvider && store?.dpayAvailable);

  const selectedCity = vanexCities.find((c) => c.id === vanexCityId);
  const selectedArea = selectedCity?.areas.find((a) => a.id === vanexAreaId);
  const shippingCents = usesVanexPricing ? selectedArea?.priceCents ?? 0 : 0;
  const discountCents = appliedCoupon?.discountCents ?? 0;
  const grandTotalCents = cart.subtotalCents + shippingCents - discountCents;

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    setCouponMessage(null);
    try {
      const result = await api.validateCoupon({ storeSlug: slug, code: couponInput.trim(), subtotalCents: cart.subtotalCents });
      if (result.valid) {
        setAppliedCoupon({ code: couponInput.trim(), discountCents: result.discountCents });
        setCouponMessage("✓ تم تطبيق الكوبون");
      } else {
        setAppliedCoupon(null);
        setCouponMessage(result.message || "رمز الكوبون غير صحيح");
      }
    } catch {
      setAppliedCoupon(null);
      setCouponMessage("تعذّر التحقق من الكوبون");
    } finally {
      setCouponChecking(false);
    }
  }

  function goToConfirmation(result: { orderId: string; totalCents: number; shippingCents: number; trackingId?: string; courier?: string; paymentStatus: string }) {
    cart.clear();
    const q = new URLSearchParams({
      orderId: result.orderId,
      totalCents: String(result.totalCents),
      shippingCents: String(result.shippingCents),
      trackingId: result.trackingId ?? "",
      courier: result.courier ?? "",
      paymentStatus: result.paymentStatus,
    });
    router.push(`/store/${slug}/confirmation?${q.toString()}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.lines.length === 0) return;
    if (usesVanexPricing && !selectedArea) {
      setError("اختر المدينة والمنطقة");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await api.createOrder({
        storeSlug: slug,
        items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, variantId: l.variantId ?? undefined })),
        buyer: {
          name,
          phone,
          email: email || undefined,
          city: selectedArea ? `${selectedCity?.name} - ${selectedArea.name}` : city,
          address,
          vanexAreaId: selectedArea?.id,
        },
        paymentMethod,
        couponCode: appliedCoupon?.code,
      });

      if (result.moamalat && result.moamalatScriptUrl) {
        pendingOrderRef.current = { orderId: result.orderId, totalCents: result.totalCents, shippingCents: result.shippingCents };
        setWalletPending(true);
        await loadLightboxScript(result.moamalatScriptUrl);
        const lightbox = result.moamalat;
        window.Lightbox!.Checkout.configure = {
          MID: lightbox.MID,
          TID: lightbox.TID,
          AmountTrxn: lightbox.AmountTrxn,
          MerchantReference: lightbox.MerchantReference,
          TrxDateTime: lightbox.TrxDateTime,
          SecureHash: lightbox.SecureHash,
          completeCallback: async (data: Record<string, string>) => {
            try {
              const completeResult = await api.moamalatComplete(data);
              const pending = pendingOrderRef.current;
              if (completeResult.status === "paid" && pending) {
                goToConfirmation({ ...pending, trackingId: completeResult.trackingId, courier: completeResult.courier, paymentStatus: "paid" });
                return;
              }
              setError(completeResult.error ?? "تعذّر تأكيد الدفع، تواصل معنا إن تم خصم المبلغ");
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "تعذّر تأكيد الدفع، تواصل معنا إن تم خصم المبلغ");
            } finally {
              setWalletPending(false);
            }
          },
          errorCallback: () => {
            setError("فشلت عملية الدفع، حاول مجددًا");
            setWalletPending(false);
          },
          cancelCallback: () => {
            setWalletPending(false);
          },
        };
        window.Lightbox!.Checkout.showLightbox();
        return;
      }

      goToConfirmation(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إتمام الطلب، حاول مجددًا");
      setWalletPending(false);
    } finally {
      setLoading(false);
    }
  }

  if (!store) return null;

  const secondary = store.customization?.secondaryColor || "#f0f0f0";

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: secondary }}>
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="rounded-2xl bg-white shadow-xl p-8">
            <h1 className="font-display text-2xl font-bold text-harbor">سلتك فارغة</h1>
            <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
              العودة إلى المتجر
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      <main className="mx-auto max-w-4xl px-6 py-16 grid md:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="rounded-2xl bg-white shadow-xl p-8">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">إتمام الطلب</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">الاسم الكامل</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
              <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">البريد الإلكتروني (اختياري)</span>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="لتصلك تحديثات الطلب"
              />
            </label>
            {usesVanexPricing ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">المدينة</span>
                  <select
                    required
                    value={vanexCityId}
                    onChange={(e) => {
                      setVanexCityId(e.target.value);
                      setVanexAreaId("");
                    }}
                    className="input"
                  >
                    <option value="">اختر المدينة</option>
                    {vanexCities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">المنطقة</span>
                  <select
                    required
                    disabled={!selectedCity}
                    value={vanexAreaId}
                    onChange={(e) => setVanexAreaId(e.target.value)}
                    className="input disabled:opacity-50"
                  >
                    <option value="">اختر المنطقة</option>
                    {selectedCity?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatLYD(a.priceCents)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="block text-sm font-bold text-harbor mb-1.5">المدينة</span>
                <input required value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="طرابلس" />
              </label>
            )}
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">العنوان بالتفصيل</span>
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                rows={3}
              />
            </label>
  
            <div>
              <span className="block text-sm font-bold text-harbor mb-1.5">شركة الشحن</span>
              <p className="rounded-xl border border-harbor/15 bg-canvas px-4 py-3 text-sm text-rope">
                {courierLabels[store.courier] ?? store.courier}
              </p>
            </div>
  
            <div>
              <span className="block text-sm font-bold text-harbor mb-2">طريقة الدفع</span>
              <div className="space-y-2">
                {store.codEnabled && (
                  <label
                    className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === "cod" ? "border-signal bg-signal/5" : "border-harbor/15 bg-canvas hover:border-harbor/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pm"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                      className="accent-signal"
                    />
                    <span className="font-bold text-harbor text-sm">الدفع عند الاستلام</span>
                  </label>
                )}
                {walletAvailable && (
                  <label
                    className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === "wallet" ? "border-signal bg-signal/5" : "border-harbor/15 bg-canvas hover:border-harbor/25"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pm"
                        checked={paymentMethod === "wallet"}
                        onChange={() => setPaymentMethod("wallet")}
                        className="accent-signal"
                      />
                      <span className="font-bold text-harbor text-sm">الدفع الإلكتروني</span>
                    </span>
                    <Image src="/payment-logos/moamalat.png" alt="Moamalat" width={90} height={30} className="h-7 w-auto object-contain" />
                  </label>
                )}
              </div>
            </div>
  
            {error && <p className="text-signal text-sm">{error}</p>}
  
            <button
              type="submit"
              disabled={loading || walletPending || (usesVanexPricing && !selectedArea)}
              className="w-full rounded-full bg-signal py-3.5 font-bold text-canvas shadow-lg shadow-signal/20 hover:bg-signal-dark hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
            >
              {loading || walletPending ? "جارٍ التأكيد..." : `تأكيد الطلب — ${formatLYD(grandTotalCents)}`}
            </button>
          </form>
        </div>
  
        <aside className="rounded-2xl bg-white shadow-xl p-6 h-fit">
          <h2 className="font-display font-bold text-harbor mb-4">ملخص الطلب</h2>
          <ul className="space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.productId} className="flex justify-between text-harbor/90">
                <span>
                  {line.name} × {line.quantity}
                </span>
                <span>{formatLYD(line.priceCents * line.quantity)}</span>
              </li>
            ))}
          </ul>
  
          <div className="mt-4 pt-4 border-t border-harbor/10">
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                className="input flex-1"
                dir="ltr"
                placeholder="رمز الكوبون"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                className="rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 disabled:opacity-50"
              >
                {couponChecking ? "..." : "تطبيق"}
              </button>
            </div>
            {couponMessage && (
              <p className={`mt-2 text-xs ${appliedCoupon ? "text-green-700" : "text-signal"}`}>{couponMessage}</p>
            )}
          </div>
  
          {usesVanexPricing && (
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-harbor/10 text-harbor/90">
              <span>الشحن</span>
              <span>{selectedArea ? formatLYD(shippingCents) : "—"}</span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex justify-between text-sm mt-3 text-green-700">
              <span>الخصم</span>
              <span>-{formatLYD(discountCents)}</span>
            </div>
          )}
          <div className="border-t border-harbor/10 mt-4 pt-4 flex justify-between font-bold text-harbor text-lg">
            <span>الإجمالي</span>
            <span>{formatLYD(grandTotalCents)}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
