"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { normalizeSubscriptionPeriod, subscriptionPeriods } from "@/lib/checkout-features";
import { api, ApiError } from "@/lib/api";
import { DPAY_PAY_METHODS, DPAY_PAY_METHOD_LABELS, DPAY_REQUIRED_FIELDS, type DpayPayMethod } from "@/lib/payment/dpay-client";

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentPageContent />
    </Suspense>
  );
}

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready } = useAuth();

  const period = normalizeSubscriptionPeriod(searchParams.get("period"));
  const periodInfo = subscriptionPeriods[period];

  // DPay is now the ONLY way to pay a subscription — the manual
  // receipt-upload flow (bank transfer + admin review) was removed once
  // DPay went live for real. Same session/OTP infrastructure as buyer
  // checkout (src/app/store/[slug]/checkout/page.tsx), just for the
  // merchant's own subscription fee instead of a store order.
  const [dpayPayMethod, setDpayPayMethod] = useState<DpayPayMethod | "">("");
  const [dpayCustomerMobile, setDpayCustomerMobile] = useState("");
  const [dpayBirthYear, setDpayBirthYear] = useState("");
  const [dpayCardNumber, setDpayCardNumber] = useState("");
  const [dpayLoading, setDpayLoading] = useState(false);
  const [dpayError, setDpayError] = useState<string | null>(null);
  const [pendingOtpPayment, setPendingOtpPayment] = useState<{ paymentId: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  async function handleDpaySubmit() {
    if (!token || !dpayPayMethod) return;
    setDpayError(null);
    setDpayLoading(true);
    try {
      const result = await api.subscriptionDpayCheckout(token, {
        period,
        dpayPayMethod,
        dpayCustomerMobile: dpayCustomerMobile || undefined,
        dpayBirthYear: dpayBirthYear || undefined,
        dpayCardNumber: dpayCardNumber || undefined,
      });

      if (result.status === "paid") {
        router.push("/dashboard");
        return;
      }
      if (result.dpay?.paymentLink) {
        window.location.href = result.dpay.paymentLink;
        return;
      }
      if (result.dpay?.requiresOtp) {
        setPendingOtpPayment({ paymentId: result.paymentId });
        return;
      }
    } catch (err) {
      setDpayError(err instanceof ApiError ? err.message : "تعذّر بدء الدفع الإلكتروني");
    } finally {
      setDpayLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingOtpPayment || !otp.trim() || !token) return;
    setOtpError(null);
    setOtpSubmitting(true);
    try {
      const result = await api.subscriptionDpayVerifyOtp(token, pendingOtpPayment.paymentId, otp.trim());
      if (result.status === "paid") {
        router.push("/dashboard");
        return;
      }
      setOtpError(result.error ?? "رمز التحقق غير صحيح، حاول مجددًا");
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : "تعذّر التحقق من رمز الدفع");
    } finally {
      setOtpSubmitting(false);
    }
  }

  if (!ready || !token) return null;

  if (pendingOtpPayment) {
    return (
      <>
        <SiteNav />
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center rounded-2xl bg-white/90 shadow-xl p-8">
            <h1 className="mb-2 font-display text-2xl font-extrabold text-harbor">أدخل رمز التحقق</h1>
            <p className="mb-8 text-rope">
              أرسلت {dpayPayMethod ? DPAY_PAY_METHOD_LABELS[dpayPayMethod as DpayPayMethod] : "جهة الدفع"} رمز تحقق إلى هاتفك — أدخله لإتمام دفع{" "}
              {periodInfo.totalPriceLYD} د.ل.
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
              <button type="button" onClick={() => setPendingOtpPayment(null)} className="w-full text-rope hover:text-harbor transition-colors text-sm">
                العودة
              </button>
            </form>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="mb-12 text-center rounded-2xl bg-white/90 shadow-xl p-8">
            <h1 className="mb-2 font-display text-3xl font-extrabold text-harbor">أكمل الدفع</h1>
            <p className="text-rope">دفع فوري وآمن عبر DPay — تفعيل حسابك مباشرة بعد الدفع</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-2xl border border-harbor/10 bg-white p-6">
                <h3 className="mb-4 font-bold text-harbor">ملخص الاشتراك</h3>
                <div className="mb-4">
                  <p className="mb-1 text-sm text-rope">المدة:</p>
                  <p className="text-xl font-bold text-harbor">{periodInfo.label}</p>
                  {periodInfo.savingsLabel && <p className="mt-1 text-sm font-bold text-signal">{periodInfo.savingsLabel}</p>}
                </div>
                <div className="border-t border-harbor/10 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-rope">السعر الشهري الفعلي</span>
                    <span className="font-bold text-harbor">{periodInfo.monthlyEquivalentLYD} د.ل</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-harbor/10 pt-3">
                    <span className="font-bold text-harbor">المبلغ المستحق الآن</span>
                    <span className="text-2xl font-extrabold text-signal">{periodInfo.totalPriceLYD} د.ل</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-sm text-green-800">
                <p className="font-bold mb-2">✅ كل الميزات مفعّلة فور الدفع</p>
                <p>DPay + التحويل المباشر + الدفع عند الاستلام لعملائك، شحن فانكس تلقائي، رسائل SMS وبريد إلكتروني، ولوحة تحكم كاملة بدون أي قيود.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-harbor/10 bg-white p-8">
                <h3 className="mb-1 text-center font-bold text-harbor">⚡ الدفع الفوري عبر DPay</h3>
                <p className="mb-6 text-center text-xs text-rope">تفعيل تلقائي فور الدفع — لا حاجة لانتظار المراجعة</p>

                <div className="mb-3 grid grid-cols-2 gap-2">
                  {DPAY_PAY_METHODS.map((m) => (
                    <label
                      key={m}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                        dpayPayMethod === m ? "border-signal bg-signal/5" : "border-harbor/10 bg-white/60"
                      }`}
                    >
                      <input type="radio" name="dpay-sub-method" checked={dpayPayMethod === m} onChange={() => setDpayPayMethod(m)} className="accent-signal" />
                      {DPAY_PAY_METHOD_LABELS[m]}
                    </label>
                  ))}
                </div>

                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("mobile") && (
                  <input
                    required
                    dir="ltr"
                    value={dpayCustomerMobile}
                    onChange={(e) => setDpayCustomerMobile(e.target.value)}
                    className="input mb-2"
                    placeholder="رقم الهاتف المسجل بالمحفظة"
                  />
                )}
                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("birthYear") && (
                  <input
                    required
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={4}
                    value={dpayBirthYear}
                    onChange={(e) => setDpayBirthYear(e.target.value)}
                    className="input mb-2"
                    placeholder="سنة الميلاد"
                  />
                )}
                {dpayPayMethod && DPAY_REQUIRED_FIELDS[dpayPayMethod].includes("cardNumber") && (
                  <input
                    required
                    dir="ltr"
                    value={dpayCardNumber}
                    onChange={(e) => setDpayCardNumber(e.target.value)}
                    className="input mb-2"
                    placeholder="رقم البطاقة"
                  />
                )}

                {dpayError && <p className="mb-2 text-sm text-signal">{dpayError}</p>}

                <button
                  type="button"
                  onClick={handleDpaySubmit}
                  disabled={!dpayPayMethod || dpayLoading}
                  className="mt-2 w-full rounded-xl bg-signal py-3.5 font-bold text-canvas transition hover:bg-signal-dark disabled:opacity-40"
                >
                  {dpayLoading ? "جارٍ المعالجة..." : `ادفع ${periodInfo.totalPriceLYD} د.ل الآن`}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button type="button" onClick={() => router.back()} className="rounded-full bg-white/90 px-4 py-2 text-rope shadow-md transition hover:text-harbor">
              العودة للخلف
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
