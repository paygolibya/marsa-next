"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { normalizeSubscriptionPeriod, subscriptionPeriods } from "@/lib/checkout-features";
import { api, ApiError } from "@/lib/api";

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

  // Moamalat LightBox is now the only way to pay a subscription — the
  // manual receipt-upload flow was removed once wallet payment went live.
  // Same "server issues a signed config, browser embeds the widget
  // directly" pattern as buyer checkout (src/app/store/[slug]/checkout).
  const [loading, setLoading] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  async function handlePay() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const result = await api.subscriptionMoamalatInit(token, period);
      setWalletPending(true);
      await loadLightboxScript(result.moamalatScriptUrl);
      const lightbox = result.lightbox;
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
            if (completeResult.status === "paid") {
              router.push("/dashboard");
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر بدء الدفع الإلكتروني");
      setWalletPending(false);
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <>
      <SiteNav />
      <main className="min-h-screen">
        <div className="mx-auto max-w-2xl px-6 py-16">
          <div className="mb-12 text-center rounded-2xl bg-white/90 shadow-xl p-8">
            <h1 className="mb-2 font-display text-3xl font-extrabold text-harbor">أكمل الدفع</h1>
            <p className="text-rope">دفع فوري وآمن عبر Moamalat — تفعيل حسابك مباشرة بعد الدفع</p>
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
                <p>Moamalat + التحويل المباشر + الدفع عند الاستلام لعملائك، شحن فانكس تلقائي، رسائل SMS وبريد إلكتروني، ولوحة تحكم كاملة بدون أي قيود.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-harbor/10 bg-white p-8">
                <h3 className="mb-1 text-center font-bold text-harbor">⚡ الدفع الفوري عبر Moamalat</h3>
                <p className="mb-6 text-center text-xs text-rope">تفعيل تلقائي فور الدفع — لا حاجة لانتظار المراجعة</p>

                {error && <p className="mb-2 text-sm text-signal">{error}</p>}

                <button
                  type="button"
                  onClick={handlePay}
                  disabled={loading || walletPending}
                  className="mt-2 w-full rounded-xl bg-signal py-3.5 font-bold text-canvas transition hover:bg-signal-dark disabled:opacity-40"
                >
                  {loading || walletPending ? "جارٍ المعالجة..." : `ادفع ${periodInfo.totalPriceLYD} د.ل الآن`}
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
