"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { getCheckoutPaymentMethods, normalizeSubscriptionTier, subscriptionPlans, type SubscriptionTier } from "@/lib/checkout-features";
import { api, ApiError } from "@/lib/api";
import { DPAY_PAY_METHODS, DPAY_PAY_METHOD_LABELS, DPAY_REQUIRED_FIELDS, type DpayPayMethod } from "@/lib/payment/dpay-client";

const PAYMENT_INFO = {
  iban: "LY26007014014011399809010",
  accountHolder: "SAIFALESLAM ALFTISI",
  bank: "NAB (NORTH AFRICA BANK)",
  description: "اشتراك منصة رفقة",
};

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

  const tier = normalizeSubscriptionTier(searchParams.get("tier"));
  const tierInfo = subscriptionPlans[tier] ?? subscriptionPlans.professional;
  const [selectedMethod, setSelectedMethod] = useState<"dpay" | "direct_transfer" | "">("");

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Instant DPay subscription payment — a real alternative to the manual
  // receipt upload below, using the same DPay session/OTP infrastructure
  // as buyer checkout (src/app/store/[slug]/checkout/page.tsx), just for
  // the merchant's own subscription fee instead of a store order.
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
        tier,
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("حجم الملف كبير جداً (الحد الأقصى 10 MB)");
      return;
    }

    const validTypes = ["image/jpeg", "image/png", "application/pdf", "image/webp"];
    if (!validTypes.includes(selectedFile.type)) {
      setError("نوع الملف غير مدعوم (PNG, JPG, PDF فقط)");
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);
  }

  async function handleUpload() {
    if (!file || !token) {
      setError("يرجى اختيار ملف");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("tier", tier);
      formData.append("amount", tierInfo.price.toString());
      if (selectedMethod) formData.append("selectedMethod", selectedMethod);

      const response = await fetch("/api/payments/upload-receipt", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "فشل تحميل الملف");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ ما");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !token) return null;

  if (pendingOtpPayment) {
    return (
      <>
        <SiteNav />
        <main className="min-h-screen bg-gradient-to-b from-canvas to-harbor/5 flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center py-16">
            <h1 className="mb-2 font-display text-2xl font-extrabold text-harbor">أدخل رمز التحقق</h1>
            <p className="mb-8 text-rope">
              أرسلت {dpayPayMethod ? DPAY_PAY_METHOD_LABELS[dpayPayMethod as DpayPayMethod] : "جهة الدفع"} رمز تحقق إلى هاتفك — أدخله لإتمام دفع{" "}
              {tierInfo.price} د.ل.
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
      <main className="min-h-screen bg-gradient-to-b from-canvas to-harbor/5">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="mb-12 text-center">
            <h1 className="mb-2 font-display text-3xl font-extrabold text-harbor">أكمل الدفع</h1>
            <p className="text-rope">حول المبلغ إلى حسابنا ثم أرسل إيصال التحويل</p>
          </div>

          {success && (
            <div className="mb-8 rounded-xl border border-green-600 bg-green-50 p-6 text-green-800">
              <p className="font-bold">✓ تم استلام إيصال الدفع بنجاح!</p>
              <p className="mt-2 text-sm">سيتم تفعيل حسابك بعد التحقق من التحويل خلال 24 ساعة</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div className="rounded-2xl border border-harbor/10 bg-white p-6">
                <h3 className="mb-4 font-bold text-harbor">ملخص الطلب</h3>
                <div className="mb-4">
                  <p className="mb-1 text-sm text-rope">الخطة:</p>
                  <p className="text-xl font-bold text-harbor">{tierInfo.displayName}</p>
                </div>
                <div className="border-t border-harbor/10 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-rope">الاشتراك الشهري</span>
                    <span className="font-bold text-harbor">{tierInfo.price} د.ل</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-harbor/10 pt-3">
                    <span className="font-bold text-harbor">المبلغ المستحق</span>
                    <span className="text-2xl font-extrabold text-signal">{tierInfo.price} د.ل</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                <h3 className="mb-4 font-bold text-harbor">📋 بيانات التحويل</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="mb-1 text-rope">البنك:</p>
                    <p className="font-bold text-harbor">{PAYMENT_INFO.bank}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-rope">صاحب الحساب:</p>
                    <p className="font-bold text-harbor">{PAYMENT_INFO.accountHolder}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-rope">رقم الآيبان (IBAN):</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg border border-harbor/10 bg-white p-3 font-mono text-xs">
                        {PAYMENT_INFO.iban}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(PAYMENT_INFO.iban);
                          alert("تم نسخ الآيبان!");
                        }}
                        className="flex-shrink-0 rounded-lg bg-harbor px-3 py-3 font-bold text-white transition hover:bg-harbor/90"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-rope">المرجع (Reference):</p>
                    <p className="font-bold text-harbor">{PAYMENT_INFO.description}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-harbor/10 bg-white p-8">
                <h3 className="mb-6 text-center font-bold text-harbor">📸 رفع إيصال التحويل</h3>

                <div className="mb-6 rounded-xl border border-harbor/10 bg-canvas p-4 text-sm text-rope">
                  <p className="mb-2 font-bold text-harbor">رسالة الخطة</p>
                  <p className="leading-7">{tierInfo.checkoutMessage}</p>
                </div>

                <div className="mb-6 rounded-xl border-2 border-signal/20 bg-signal/5 p-5">
                  <h4 className="mb-1 font-bold text-harbor">⚡ الدفع الفوري عبر DPay</h4>
                  <p className="mb-4 text-xs text-rope">تفعيل تلقائي فور الدفع — لا حاجة لانتظار المراجعة</p>

                  <div className="mb-3 grid grid-cols-2 gap-2">
                    {DPAY_PAY_METHODS.map((m) => (
                      <label
                        key={m}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                          dpayPayMethod === m ? "border-signal bg-white" : "border-harbor/10 bg-white/60"
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
                    className="w-full rounded-xl bg-signal py-3 font-bold text-canvas transition hover:bg-signal-dark disabled:opacity-40"
                  >
                    {dpayLoading ? "جارٍ المعالجة..." : `ادفع ${tierInfo.price} د.ل الآن`}
                  </button>
                </div>

                <div className="mb-6 flex items-center gap-3 text-xs text-rope">
                  <div className="h-px flex-1 bg-harbor/10" />
                  أو حوّل يدويًا وارفع الإيصال
                  <div className="h-px flex-1 bg-harbor/10" />
                </div>

                {/* This chooses which checkout method the MERCHANT'S OWN
                    STORE will offer ITS customers (professional tier only
                    allows one) — it does not itself charge anything or
                    start a DPay session. Paying for the subscription itself
                    is always the receipt-upload step below, regardless of
                    which method is picked here — a real, working feature
                    (see getCheckoutPaymentMethods in checkout-features.ts),
                    just worded ambiguously enough to read as a "pay via
                    DPay now" button. */}
                {tier === "professional" && (
                  <div className="mb-6 space-y-3 rounded-xl border border-harbor/10 bg-blue-50 p-4 text-right">
                    <p className="font-bold text-harbor">اختر طريقة الدفع التي سيوفرها متجرك لعملائك</p>
                    <p className="text-xs text-rope">هذا لا يدفع اشتراكك — اشتراكك يُدفع دائمًا عبر التحويل البنكي أدناه، بغض النظر عن اختيارك هنا.</p>
                    <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span>الدفع الإلكتروني (DPay) لعملائك</span>
                      <input type="radio" name="method" checked={selectedMethod === "dpay"} onChange={() => setSelectedMethod("dpay")} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span>التحويل البنكي المباشر لعملائك</span>
                      <input type="radio" name="method" checked={selectedMethod === "direct_transfer"} onChange={() => setSelectedMethod("direct_transfer")} />
                    </label>
                  </div>
                )}

                {tier === "advanced" && (
                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-right text-sm text-green-800">
                    <p className="font-bold">طرق الدفع المتاحة لعملائك: جميعها مفعّلة</p>
                    <p className="mt-2">DPay + التحويل المباشر + الدفع عند الاستلام. اشتراكك أنت يُدفع دائمًا عبر التحويل البنكي أدناه.</p>
                  </div>
                )}

                <div className="mb-6">
                  <label className="block cursor-pointer">
                    <div className="rounded-xl border-2 border-dashed border-harbor/20 p-8 text-center transition hover:border-signal/50 hover:bg-signal/5">
                      <div className="mb-3 text-4xl">📄</div>
                      <p className="mb-2 font-bold text-harbor">اختر صورة الإيصال</p>
                      <p className="mb-3 text-sm text-rope">اسحب وأفلت أو انقر للاختيار</p>
                      <p className="text-xs text-rope">PNG, JPG, PDF (حد أقصى 10 MB)</p>
                    </div>
                    <input type="file" accept=".png,.jpg,.jpeg,.pdf,.webp" onChange={handleFileChange} className="hidden" disabled={loading} />
                  </label>
                </div>

                {fileName && (
                  <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="text-sm text-green-800">
                      ✓ تم اختيار: <span className="font-bold">{fileName}</span>
                    </p>
                  </div>
                )}

                {error && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button type="button" onClick={handleUpload} disabled={!file || loading} className="w-full rounded-xl bg-signal py-4 font-bold text-canvas transition hover:bg-signal/90 disabled:opacity-40">
                  {loading ? "جاري الرفع..." : "رفع الإيصال"}
                </button>

                <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-bold">📝 تذكير مهم:</p>
                  <ul className="space-y-1">
                    <li>✓ تأكد من أن الإيصال واضح وقابل للقراءة</li>
                    <li>✓ يجب أن يظهر المبلغ والتاريخ والحالة</li>
                    <li>✓ سيتم التحقق منه خلال 24 ساعة</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button type="button" onClick={() => router.back()} className="text-rope transition hover:text-harbor">
              العودة للخلف
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
