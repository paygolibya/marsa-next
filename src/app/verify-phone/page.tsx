"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={null}>
      <VerifyPhonePageContent />
    </Suspense>
  );
}

function VerifyPhonePageContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { token, merchant, ready, refreshMerchant, logout } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    search.get("sendFailed") ? "تعذّر إرسال رمز التحقق، جرّب إعادة الإرسال" : null
  );
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  useEffect(() => {
    if (ready && merchant?.phoneVerified) router.replace("/onboarding");
  }, [ready, merchant, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      await api.verifyOtp(token, code);
      await refreshMerchant();
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر التحقق، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!token) return;
    setError(null);
    setResendMessage(null);
    setResending(true);
    try {
      await api.resendOtp(token);
      setResendMessage("✓ تم إرسال رمز جديد");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إعادة الإرسال");
    } finally {
      setResending(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <div className="rounded-2xl bg-white/90 shadow-xl p-8">
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">تحقق من رقم هاتفك</h1>
        <p className="text-rope mb-8">
          أرسلنا رمز تحقق مكوّن من 6 أرقام إلى <span dir="ltr" className="font-bold text-harbor">{merchant?.phone}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            required
            dir="ltr"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="input text-center text-2xl tracking-[0.5em] font-bold"
            placeholder="000000"
          />

          {error && <p className="text-signal text-sm">{error}</p>}
          {resendMessage && <p className="text-sm text-green-700">{resendMessage}</p>}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ التحقق..." : "تحقق"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-4 text-sm">
          <button onClick={handleResend} disabled={resending} className="font-bold text-brass hover:underline disabled:opacity-60">
            {resending ? "جارٍ الإرسال..." : "إعادة إرسال الرمز"}
          </button>
          <button onClick={logout} className="text-rope hover:text-harbor transition-colors">
            تسجيل الخروج
          </button>
        </div>
        </div>
      </main>
    </>
  );
}
