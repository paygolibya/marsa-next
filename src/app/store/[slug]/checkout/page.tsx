"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store, type VanexCity } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { DPAY_PAY_METHODS, DPAY_PAY_METHOD_LABELS, DPAY_REQUIRED_FIELDS, type DpayPayMethod } from "@/lib/payment/dpay-client";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
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
  const [dpayPayMethod, setDpayPayMethod] = useState<DpayPayMethod | "">("");
  const [dpayCustomerMobile, setDpayCustomerMobile] = useState("");
  const [dpayBirthYear, setDpayBirthYear] = useState("");
  const [dpayCardNumber, setDpayCardNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set once /api/orders opens a real DPay session that needs the buyer to
  // enter an OTP — switches the page from the checkout form to the OTP step.
  const [pendingOtpOrder, setPendingOtpOrder] = useState<{ orderId: string; totalCents: number; shippingCents: number } | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

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
    if (paymentMethod === "wallet" && !dpayPayMethod) {
      setError("اختر طريقة الدفع الإلكتروني");
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
        dpayPayMethod: paymentMethod === "wallet" ? (dpayPayMethod as DpayPayMethod) : undefined,
        dpayCustomerMobile: dpayCustomerMobile || undefined,
        dpayBirthYear: dpayBirthYear || undefined,
        dpayCardNumber: dpayCardNumber || undefined,
        couponCode: appliedCoupon?.code,
      });

      if (result.dpay) {
        if (result.dpay.paymentLink) {
          // Moamalat — hosted LightBox page. Our order already exists
          // (pending); DPay's webhook confirms it once the customer pays.
          window.location.href = result.dpay.paymentLink;
          return;
        }
        if (result.dpay.requiresOtp) {
          setPendingOtpOrder({ orderId: result.orderId, totalCents: result.totalCents, shippingCents: result.shippingCents });
          return;
        }
      }

      goToConfirmation(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إتمام الطلب، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingOtpOrder || !otp.trim()) return;
    setOtpError(null);
    setOtpSubmitting(true);
    try {
      const result = await api.dpayVerifyOtp(pendingOtpOrder.orderId, otp.trim());
      if (result.status === "paid") {
        goToConfirmation({ ...pendingOtpOrder, trackingId: result.trackingId, courier: result.courier, paymentStatus: "paid" });
        return;
      }
      setOtpError(result.error ?? "رمز التحقق غير صحيح، حاول مجددًا");
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : "تعذّر التحقق من رمز الدفع");
    } finally {
      setOtpSubmitting(false);
    }
  }

  if (!store) return null;

  if (cart.ready && cart.lines.length === 0 && !pendingOtpOrder) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">سلتك فارغة</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  if (pendingOtpOrder) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">أدخل رمز التحقق</h1>
        <p className="text-rope mb-8">
          أرسلت {dpayPayMethod ? DPAY_PAY_METHOD_LABELS[dpayPayMethod as DpayPayMethod] : "جهة الدفع"} رمز تحقق إلى هاتفك — أدخله لإتمام دفع{" "}
          {formatLYD(pendingOtpOrder.totalCents)}.
        </p>
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <input
            required
            dir="ltr"
            inputMode="numeric"
            autoFocus
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="input text-center text-2xl tracking-[0.5em]"
            placeholder="••••••"
          />
          {otpError && <p className="text-signal text-sm">{otpError}</p>}
          <button
            type="submit"
            disabled={otpSubmitting || !otp.trim()}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {otpSubmitting ? "جارٍ التحقق..." : "تأكيد الدفع"}
          </button>
          <button type="button" onClick={() => setPendingOtpOrder(null)} className="w-full text-rope hover:text-harbor transition-colors text-sm">
            العودة لتغيير طريقة الدفع
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 grid md:grid-cols-[1.2fr_1fr] gap-10">
      <div>
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
            <p className="rounded-xl border border-harbor/15 bg-white px-4 py-3 text-sm text-rope">
              {courierLabels[store.courier] ?? store.courier}
            </p>
          </div>

          <div>
            <span className="block text-sm font-bold text-harbor mb-2">طريقة الدفع</span>
            <div className="space-y-2">
              {store.codEnabled && (
                <label className="flex items-center gap-2 rounded-xl border border-harbor/15 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="accent-brass"
                  />
                  الدفع عند الاستلام
                </label>
              )}
              {walletAvailable && (
                <label className="flex items-center gap-2 rounded-xl border border-harbor/15 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === "wallet"}
                    onChange={() => setPaymentMethod("wallet")}
                    className="accent-brass"
                  />
                  الدفع الإلكتروني
                </label>
              )}
            </div>

            {paymentMethod === "wallet" && walletAvailable && (
              <div className="mt-3 rounded-xl border border-harbor/15 bg-white p-4 space-y-3">
                <span className="block text-sm font-bold text-harbor">اختر جهة الدفع</span>
                <div className="grid grid-cols-2 gap-2">
                  {DPAY_PAY_METHODS.map((m) => (
                    <label
                      key={m}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                        dpayPayMethod === m ? "border-brass bg-brass/5" : "border-harbor/10"
                      }`}
                    >
                      <input type="radio" name="dpay-method" checked={dpayPayMethod === m} onChange={() => setDpayPayMethod(m)} className="accent-brass" />
                      {DPAY_PAY_METHOD_LABELS[m]}
                    </label>
                  ))}
                </div>

                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("mobile") && (
                  <label className="block">
                    <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف المسجل بالمحفظة</span>
                    <input
                      required
                      dir="ltr"
                      value={dpayCustomerMobile}
                      onChange={(e) => setDpayCustomerMobile(e.target.value)}
                      className="input"
                      placeholder="0912345678"
                    />
                  </label>
                )}
                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("birthYear") && (
                  <label className="block">
                    <span className="block text-sm font-bold text-harbor mb-1.5">سنة الميلاد</span>
                    <input
                      required
                      dir="ltr"
                      inputMode="numeric"
                      maxLength={4}
                      value={dpayBirthYear}
                      onChange={(e) => setDpayBirthYear(e.target.value)}
                      className="input"
                      placeholder="1994"
                    />
                  </label>
                )}
                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("cardNumber") && (
                  <label className="block">
                    <span className="block text-sm font-bold text-harbor mb-1.5">رقم البطاقة</span>
                    <input
                      required
                      dir="ltr"
                      value={dpayCardNumber}
                      onChange={(e) => setDpayCardNumber(e.target.value)}
                      className="input"
                      placeholder="1234567"
                    />
                  </label>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || (usesVanexPricing && !selectedArea) || (paymentMethod === "wallet" && !dpayPayMethod)}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ التأكيد..." : `تأكيد الطلب — ${formatLYD(grandTotalCents)}`}
          </button>
        </form>
      </div>

      <aside className="rounded-2xl border border-harbor/10 bg-white/50 p-6 h-fit">
        <h2 className="font-display font-bold text-harbor mb-4">ملخص الطلب</h2>
        <ul className="space-y-3 text-sm">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex justify-between">
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
          <div className="flex justify-between text-sm mt-3 pt-3 border-t border-harbor/10">
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
        <div className="border-t border-harbor/10 mt-4 pt-4 flex justify-between font-bold text-harbor">
          <span>الإجمالي</span>
          <span>{formatLYD(grandTotalCents)}</span>
        </div>
      </aside>
    </main>
  );
}
