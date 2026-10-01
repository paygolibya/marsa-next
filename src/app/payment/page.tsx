"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { normalizeSubscriptionPeriod, subscriptionPeriods } from "@/lib/checkout-features";
import { api, ApiError } from "@/lib/api";

export default function PaymentPage() {
  return (
    <Suspense fallback={null}>
      <PaymentPageContent />
    </Suspense>
  );
}

// Non-null while waiting for the merchant to finish paying in the DPay
// tab — same new-tab + poll pattern as buyer checkout
// (src/app/store/[slug]/checkout/page.tsx), since DPay hosts the entire
// card-entry + OTP flow on its own page now (no embeddable widget).
type WalletSession = { paymentLink: string; expiresAt: string; popupBlocked: boolean; expired: boolean };

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, ready, refreshMerchant } = useAuth();

  const period = normalizeSubscriptionPeriod(searchParams.get("period"));
  const periodInfo = subscriptionPeriods[period];

  const [loading, setLoading] = useState(false);
  const [walletSession, setWalletSession] = useState<WalletSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  async function handlePay() {
    if (!token) return;
    setError(null);
    setLoading(true);

    // Must happen synchronously, before the await below — see buyer
    // checkout's identical comment on why.
    const paymentWindow = window.open("", "_blank");

    try {
      const result = await api.subscriptionDpayInit(token, period);
      if (paymentWindow) paymentWindow.location.href = result.dpayPaymentLink;
      setWalletSession({
        paymentLink: result.dpayPaymentLink,
        expiresAt: result.dpaySessionExpiresAt,
        popupBlocked: !paymentWindow,
        expired: false,
      });
    } catch (err) {
      paymentWindow?.close();
      setError(err instanceof ApiError ? err.message : "تعذّر بدء الدفع الإلكتروني");
    } finally {
      setLoading(false);
    }
  }

  // Polls the merchant's own authed session (already fetches
  // subscriptionStatus) — no new backend surface needed. Refreshing it
  // here (rather than just router.push) means the dashboard sees the
  // newly-active subscription immediately instead of needing a manual
  // "تحقق من الحالة" click.
  useEffect(() => {
    if (!walletSession || walletSession.expired || !token) return;
    const expiresAtMs = new Date(walletSession.expiresAt).getTime();

    const interval = setInterval(async () => {
      if (Date.now() > expiresAtMs) {
        setWalletSession((s) => (s ? { ...s, expired: true } : s));
        return;
      }
      try {
        const { merchant } = await api.me(token);
        if (merchant.subscriptionStatus === "active") {
          await refreshMerchant();
          router.push("/dashboard");
        }
      } catch {
        // transient network hiccup — the next tick retries
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletSession?.expiresAt, walletSession?.expired, token]);

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

          {walletSession ? (
            <div className="rounded-2xl border border-harbor/10 bg-white p-8 text-center">
              {walletSession.expired ? (
                <>
                  <p className="font-bold text-harbor mb-2">انتهت صلاحية جلسة الدفع</p>
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
                  <p className="font-bold text-harbor mb-2">في انتظار تأكيد الدفع...</p>
                  <p className="text-rope text-sm mb-6">
                    أكمل الدفع في النافذة التي فُتحت لك. سننقلك تلقائيًا إلى لوحة التحكم فور نجاح الدفع.
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
                    disabled={loading}
                    className="mt-2 w-full rounded-xl bg-signal py-3.5 font-bold text-canvas transition hover:bg-signal-dark disabled:opacity-40"
                  >
                    {loading ? "جارٍ المعالجة..." : `ادفع ${periodInfo.totalPriceLYD} د.ل الآن`}
                  </button>
                </div>
              </div>
            </div>
          )}

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
