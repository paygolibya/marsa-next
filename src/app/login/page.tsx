"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, merchant } = await api.login({ phone, password });
      login(token, merchant);
      router.push(isAdminMerchant(merchant) ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تسجيل الدخول، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-3xl font-extrabold text-harbor mb-2">تسجيل الدخول</h1>
        <p className="text-rope mb-8">مرحبًا بعودتك.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              dir="ltr"
              placeholder="0910000000"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">كلمة المرور</span>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              dir="ltr"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <p className="mt-6 text-sm text-rope">
          ليس لديك حساب؟{" "}
          <Link href="/register" className="text-brass font-bold">
            أنشئ حسابًا
          </Link>
        </p>
      </main>
    </>
  );
}
