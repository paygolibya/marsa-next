"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { getCheckoutPaymentMethods, normalizeSubscriptionTier, subscriptionPlans, type SubscriptionTier } from "@/lib/checkout-features";

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

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

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

                {tier === "professional" && (
                  <div className="mb-6 space-y-3 rounded-xl border border-harbor/10 bg-blue-50 p-4 text-right">
                    <p className="font-bold text-harbor">اختر طريقة الدفع الفعّالة</p>
                    <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span>الدفع عبر DPay</span>
                      <input type="radio" name="method" checked={selectedMethod === "dpay"} onChange={() => setSelectedMethod("dpay")} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                      <span>تحويل بنكي مباشر</span>
                      <input type="radio" name="method" checked={selectedMethod === "direct_transfer"} onChange={() => setSelectedMethod("direct_transfer")} />
                    </label>
                  </div>
                )}

                {tier === "advanced" && (
                  <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-right text-sm text-green-800">
                    <p className="font-bold">الطريقة المتاحة: جميع الأساليب مفعلة</p>
                    <p className="mt-2">DPay + التحويل المباشر + الدفع عند الاستلام</p>
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
