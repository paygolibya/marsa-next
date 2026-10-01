"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store, type VanexCity } from "@/lib/api";
import { useCart } from "@/lib/use-cart";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
};

// DPay hosts the entire card-entry + OTP flow on its own page (no
// embeddable widget, unlike the old direct-Moamalat LightBox) — the
// buyer finishes paying in a new tab while this one polls for
// confirmation (api.trackOrder, the same endpoint the public order-
// tracking page uses). order.status only flips to "confirmed" once the
// DPay webhook confirms payment server-side (src/lib/payment/dpay-order.ts).
type WalletSession = {
  orderId: string;
  totalCents: number;
  shippingCents: number;
  phone: string;
  paymentLink: string;
  expiresAt: string;
  // window.open("", "_blank") must happen synchronously inside the click
  // handler, before any await — calling it only once we have the real
  // link (after an await) is reliably treated as NOT a user gesture by
  // mobile Safari/Chrome and silently blocked. If it WAS blocked (null),
  // fall back to a visible link the buyer taps themselves.
  popupBlocked: boolean;
  expired: boolean;
};

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
  // Non-null while waiting for the buyer to finish paying in the DPay tab
  // — keeps the submit button disabled without reusing `loading` (which
  // only covers the initial /api/orders call).
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const usesVanexPricing = store?.courier === "vanex";
  const [vanexCities, setVanexCities] = useState<VanexCity[]>([]);
  const [vanexCityId, setVanexCityId] = useState("");
  const [vanexAreaId, setVanexAreaId] = useState("");

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

    // Must happen synchronously, before the order-creation await below —
    // see WalletSession's comment on popupBlocked.
    const paymentWindow = paymentMethod === "wallet" ? window.open("", "_blank") : null;

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

      if (result.dpayPaymentLink) {
        if (paymentWindow) paymentWindow.location.href = result.dpayPaymentLink;
        setWalletSession({
          orderId: result.orderId,
          totalCents: result.totalCents,
          shippingCents: result.shippingCents,
          phone,
          paymentLink: result.dpayPaymentLink,
          expiresAt: result.dpaySessionExpiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          popupBlocked: !paymentWindow,
          expired: false,
        });
        return;
      }

      goToConfirmation(result);
    } catch (err) {
      paymentWindow?.close();
      setError(err instanceof ApiError ? err.message : "تعذّر إتمام الطلب، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  // Polls the same public endpoint the order-tracking page uses — no new
  // backend surface needed. Stops at the session's own expiry rather than
  // polling forever if the buyer abandons the DPay tab without paying.
  useEffect(() => {
    if (!walletSession || walletSession.expired) return;
    const expiresAtMs = new Date(walletSession.expiresAt).getTime();

    const interval = setInterval(async () => {
      if (Date.now() > expiresAtMs) {
        setWalletSession((s) => (s ? { ...s, expired: true } : s));
        return;
      }
      try {
        const track = await api.trackOrder(walletSession.orderId, walletSession.phone);
        if (track.status === "confirmed") {
          goToConfirmation({
            orderId: walletSession.orderId,
            totalCents: walletSession.totalCents,
            shippingCents: walletSession.shippingCents,
            trackingId: track.courierTrackingId ?? undefined,
            courier: store?.courier,
            paymentStatus: "paid",
          });
        }
      } catch {
        // transient network hiccup — the next tick retries
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletSession?.orderId, walletSession?.expired]);

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
          {walletSession ? (
            <div className="text-center py-6">
              {walletSession.expired ? (
                <>
                  <p className="text-harbor font-bold mb-2">انتهت صلاحية جلسة الدفع</p>
                  <p className="text-rope text-sm mb-6">لم يتم إكمال الدفع في الوقت المحدد. يمكنك المحاولة مجددًا.</p>
                  <button
                    type="button"
                    onClick={() => setWalletSession(null)}
                    className="rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors"
                  >
                    حاول مجددًا
                  </button>
                </>
              ) : (
                <>
                  <p className="text-harbor font-bold mb-2">في انتظار تأكيد الدفع...</p>
                  <p className="text-rope text-sm mb-6">
                    أكمل الدفع في النافذة التي فُتحت لك. سننقلك تلقائيًا إلى صفحة التأكيد فور نجاح الدفع.
                  </p>
                  {walletSession.popupBlocked && (
                    <a
                      href={walletSession.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors"
                    >
                      اضغط هنا لإكمال الدفع
                    </a>
                  )}
                </>
              )}
            </div>
          ) : (
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
                    {/* width/height must match the real file's aspect ratio
                        (2077x1126, ~1.84:1) — the old 90x30 (3:1) guess gave
                        Next's Image component a wrong aspect-ratio hint that
                        conflicted with w-auto, so browsers disagreed on how
                        to size it (broken on desktop, glitching on mobile). */}
                    <Image src="/payment-logos/moamalat.png" alt="Moamalat" width={177} height={96} className="h-7 w-auto object-contain" />
                  </label>
                )}
              </div>
            </div>
  
            {error && <p className="text-signal text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || (usesVanexPricing && !selectedArea)}
              className="w-full rounded-full bg-signal py-3.5 font-bold text-canvas shadow-lg shadow-signal/20 hover:bg-signal-dark hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
            >
              {loading ? "جارٍ التأكيد..." : `تأكيد الطلب — ${formatLYD(grandTotalCents)}`}
            </button>
          </form>
          )}
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
