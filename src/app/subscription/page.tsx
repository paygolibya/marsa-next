"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PLATFORM_FEATURES, subscriptionPeriods, type SubscriptionPeriod } from "@/lib/checkout-features";
import { SiteNav } from "@/components/site-nav";
import { Icon } from "@/components/ui";

const periodList = Object.values(subscriptionPeriods);

// Plan picker — the step between a reminder / locked dashboard and paying.
// Reworked for conversion (card structure from 21st.dev's Pricing Section,
// same as the homepage): plans come first (the feature list used to push
// them several screens down on a phone), each card shows the real price
// this merchant will pay — with the 75 LYD first-payment discount applied
// when they're eligible, previously only revealed on the next page — and
// each card's button goes straight to payment instead of "select, then
// scroll to a separate button".
export default function SubscriptionPage() {
  const router = useRouter();
  const { token, merchant } = useAuth();
  const [discountLYD, setDiscountLYD] = useState(0);
  const [going, setGoing] = useState<SubscriptionPeriod | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .subscriptionPricing(token)
      .then((p) => setDiscountLYD(p.firstPaymentDiscountEligible ? p.discountLYD : 0))
      .catch(() => setDiscountLYD(0));
  }, [token]);

  // Trial/period ran out: the dashboard is locked and the storefront is
  // paused (lib/subscription/access.ts) — say so at the top.
  const lapsed = merchant?.subscriptionStatus === "inactive" && Boolean(merchant?.subscriptionEndDate);

  function choose(period: SubscriptionPeriod) {
    setGoing(period);
    const target = `/payment?period=${period}`;
    router.push(token ? target : `/login?next=${encodeURIComponent(target)}`);
  }

  return (
    <>
      <SiteNav />
      <div className="min-h-screen px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-4xl">خطة واحدة، كل الميزات</h1>
            <p className="mt-3 text-lg text-white/90">اختر المدة التي تناسبك — نفس الميزات الكاملة في كل مدة.</p>
          </div>

          {lapsed && (
            <p className="mx-auto mb-6 flex max-w-2xl items-center gap-3 rounded-2xl bg-white p-4 font-bold text-harbor shadow-lg">
              <Icon name="alert" size={22} className="shrink-0 text-signal" />
              متجرك متوقف حاليًا ولا يستقبل طلبات. اشترك الآن ليعود متجرك للعمل فورًا.
            </p>
          )}

          {discountLYD > 0 && (
            <p className="mx-auto mb-8 flex max-w-2xl items-center justify-center gap-2 rounded-2xl bg-white/90 px-5 py-3 text-center font-bold text-harbor shadow-lg">
              <Icon name="gift" size={20} className="shrink-0 text-signal" />
              خصم {discountLYD} د.ل على أول اشتراك مدفوع — مطبّق على الأسعار أدناه.
            </p>
          )}

          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
            {periodList.map((period) => {
              const popular = period.id === "3m";
              const price = period.totalPriceLYD - discountLYD;
              return (
                <div
                  key={period.id}
                  className={`relative flex h-full flex-col rounded-3xl p-7 ${
                    popular
                      ? "bg-gradient-to-br from-signal via-rose to-brass text-white shadow-2xl shadow-signal/30 ring-4 ring-white/70 md:scale-[1.03]"
                      : "border border-white/60 bg-white text-harbor shadow-lg"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-extrabold">{period.label}</h2>
                      <p className={`mt-1 text-sm ${popular ? "text-white/85" : "text-harbor/60"}`}>{period.tagline}</p>
                    </div>
                    {period.badge && (
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${popular ? "bg-white text-signal shadow-md" : "bg-signal/10 text-signal"}`}>
                        {period.badge}
                      </span>
                    )}
                  </div>

                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-extrabold tracking-tight">{price}</span>
                    <span className="text-base font-bold">د.ل</span>
                    {discountLYD > 0 && (
                      <span className={`text-lg line-through ${popular ? "text-white/60" : "text-harbor/40"}`}>{period.totalPriceLYD}</span>
                    )}
                  </p>
                  <p className={`mt-1 text-sm ${popular ? "text-white/85" : "text-harbor/60"}`}>
                    = {period.monthlyEquivalentLYD} د.ل / شهر بالسعر العادي
                  </p>
                  {period.savingsLabel && (
                    <p className={`mt-3 inline-block w-fit rounded-full px-3 py-1 text-xs font-bold ${popular ? "bg-white/20 text-white" : "bg-signal/10 text-signal"}`}>
                      {period.savingsLabel}
                    </p>
                  )}

                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => choose(period.id)}
                    disabled={going !== null}
                    className={`mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98] disabled:opacity-60 ${
                      popular ? "bg-white text-signal shadow-lg hover:bg-white/90" : "bg-harbor text-canvas hover:bg-harbor-deep"
                    }`}
                  >
                    {going === period.id ? "جارٍ المتابعة..." : `ادفع ${price} د.ل`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-3xl bg-white p-7 shadow-lg">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-harbor">
              <Icon name="checkCircle" size={22} className="text-signal" />
              كل هذا مُفعّل في كل مدة
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PLATFORM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-harbor/80">
                  <Icon name="check" size={16} strokeWidth={2.5} className="mt-0.5 shrink-0 text-signal" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
