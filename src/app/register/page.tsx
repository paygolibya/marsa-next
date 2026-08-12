"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, merchant, otpSendFailed } = await api.register({ name, phone, password });
      login(token, merchant);
      router.push(otpSendFailed ? "/verify-phone?sendFailed=1" : "/verify-phone");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إنشاء الحساب، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-md px-6 py-20">
        <h1 className="font-display text-3xl font-extrabold text-harbor mb-2">أنشئ حسابك في رفقة</h1>
        <p className="text-rope mb-8">خطوة واحدة تفصلك عن إنشاء متجرك الأول.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="الاسم الكامل">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="أحمد الطرابلسي"
            />
          </Field>
          <Field label="رقم الهاتف">
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input"
              placeholder="0910000000"
              dir="ltr"
            />
          </Field>
          <Field label="كلمة المرور">
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="8 أحرف على الأقل"
              dir="ltr"
            />
          </Field>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
          </button>
        </form>

        <p className="mt-6 text-sm text-rope">
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="text-brass font-bold">
            سجّل الدخول
          </Link>
        </p>
      </main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-bold text-harbor mb-1.5">{label}</span>
      {children}
    </label>
  );
}
