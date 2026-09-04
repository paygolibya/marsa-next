"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_FEATURES, subscriptionPeriods, type SubscriptionPeriod } from "@/lib/checkout-features";

const periodList = Object.values(subscriptionPeriods);

export default function SubscriptionPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<SubscriptionPeriod>("3m");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = () => {
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(true);
    router.push(`/payment?period=${selectedPeriod}`);
  };

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 inline-block rounded-2xl bg-white/90 shadow-xl px-8 py-6">
          <h1 className="mb-2 text-right font-display text-4xl font-bold text-harbor">خطة واحدة، كل الميزات</h1>
          <p className="text-right text-rope">اختر المدة التي تناسبك — نفس الميزات الكاملة في كل مدة، فقط السعر يختلف.</p>
        </div>

        {/* One shared feature checklist — there's only one plan now, so
            this doesn't repeat per-card like the old 3-tier layout did. */}
        <div className="mb-10 rounded-2xl bg-white/90 shadow-xl p-8">
          <h2 className="mb-4 font-display text-lg font-bold text-harbor">📦 كل هذا مُفعّل من أول يوم</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {PLATFORM_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-harbor/80">
                <span className="text-signal">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl bg-brass/10 p-3 text-sm font-bold text-harbor">
            🎁 بونص: أول 3 أشهر مجانًا عند التسجيل — بدون بطاقة ائتمان، وبكل الميزات كاملة.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 items-stretch">
          {periodList.map((period) => {
            const selected = selectedPeriod === period.id;
            const popular = period.id === "3m";
            return (
              <div
                key={period.id}
                onClick={() => setSelectedPeriod(period.id)}
                className={`relative cursor-pointer h-full rounded-2xl p-8 flex flex-col transition-all duration-300 ${
                  popular
                    ? "bg-gradient-to-br from-signal via-rose to-brass text-white shadow-2xl scale-[1.03]"
                    : "bg-white/95 text-harbor shadow-md"
                } ${selected ? "ring-4 ring-harbor/20" : ""}`}
              >
                {period.badge && (
                  <span className="absolute -top-3 right-6 rounded-full bg-white px-4 py-1 text-xs font-bold text-signal shadow-lg">
                    {period.badge}
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{period.label}</h3>
                <p className={`text-sm mt-1 ${popular ? "text-white/80" : "text-rope"}`}>{period.tagline}</p>
                <p className="mt-6 mb-1">
                  <span className="font-display text-4xl font-extrabold">{period.totalPriceLYD}</span>
                  <span className="text-sm"> د.ل</span>
                </p>
                <p className={`text-xs mb-6 ${popular ? "text-white/80" : "text-rope"}`}>
                  = {period.monthlyEquivalentLYD} د.ل / شهر
                </p>
                {period.savingsLabel && (
                  <p className={`mb-6 inline-block rounded-full px-3 py-1 text-xs font-bold w-fit ${popular ? "bg-white/20 text-white" : "bg-signal/10 text-signal"}`}>
                    {period.savingsLabel}
                  </p>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  className={`w-full rounded-full py-3 text-center font-bold transition ${
                    popular ? "bg-white text-signal hover:bg-white/90" : selected ? "bg-harbor text-canvas" : "bg-harbor/5 text-harbor hover:bg-harbor/10"
                  }`}
                >
                  {selected ? "✓ مختار" : "اختر هذه المدة"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="rounded-full bg-signal px-12 py-4 text-lg font-bold text-canvas shadow-xl transition hover:bg-signal-dark disabled:opacity-60"
          >
            {loading ? "جارٍ المتابعة..." : "الذهاب للدفع"}
          </button>
        </div>
      </div>
    </div>
  );
}
