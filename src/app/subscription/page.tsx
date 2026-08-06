"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { subscriptionPlans, type SubscriptionTier } from "@/lib/checkout-features";

export default function SubscriptionPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>("basic");
  const [loading, setLoading] = useState(false);

  const tiers = useMemo(
    () => [
      {
        id: "basic" as const,
        name: subscriptionPlans.basic.name,
        displayName: subscriptionPlans.basic.displayName,
        price: subscriptionPlans.basic.price,
        description: subscriptionPlans.basic.description,
        checkoutMessage: subscriptionPlans.basic.checkoutMessage,
        features: ["طرق دفع يدويّة", "رفع إيصال التحويل", "مزامنة الطلبات", "التخطيط الأساسي"],
      },
      {
        id: "professional" as const,
        name: subscriptionPlans.professional.name,
        displayName: subscriptionPlans.professional.displayName,
        price: subscriptionPlans.professional.price,
        description: subscriptionPlans.professional.description,
        checkoutMessage: subscriptionPlans.professional.checkoutMessage,
        features: ["اختيار طريقة دفع واحدة", "DPay أو تحويل مباشر", "تفعيل الدفع الآلي", "رسائل الدفع المخصصة"],
        recommended: true,
      },
      {
        id: "advanced" as const,
        name: subscriptionPlans.advanced.name,
        displayName: subscriptionPlans.advanced.displayName,
        price: subscriptionPlans.advanced.price,
        description: subscriptionPlans.advanced.description,
        checkoutMessage: subscriptionPlans.advanced.checkoutMessage,
        features: ["كل طرق الدفع دفعة واحدة", "DPay + تحويل + COD", "الوصول إلى API", "تحليلات متقدمة ودعم مخصص"],
      },
    ],
    []
  );

  const handleSubscribe = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      router.push(`/payment?tier=${selectedTier}`);
    } catch (error) {
      console.error("Subscription error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-right text-4xl font-bold">اختر خطتك</h1>
        <p className="mb-12 text-right text-gray-600">ابدأ مجاناً ورقّب لاحقاً</p>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`cursor-pointer rounded-lg border-2 bg-white p-8 transition ${
                selectedTier === tier.id ? "border-brass shadow-lg" : "border-gray-200 hover:border-brass/60"
              } ${tier.recommended ? "ring-2 ring-yellow-400" : ""}`}
              onClick={() => setSelectedTier(tier.id)}
            >
              {tier.recommended && (
                <div className="mb-4 inline-block rounded bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-800">
                  الأكثر شيوعاً
                </div>
              )}

              <h3 className="mb-2 text-right text-2xl font-bold">{tier.displayName}</h3>
              <p className="mb-4 text-right text-sm text-gray-600">{tier.description}</p>
              <div className="mb-6 text-right">
                <span className="text-4xl font-bold">{tier.price}</span>
                <span className="text-gray-600"> د.ل/شهر</span>
              </div>

              <ul className="mb-8 space-y-3 text-right">
                {tier.features.map((feature, index) => (
                  <li key={`${tier.id}-${index}`} className="flex items-center justify-end gap-2">
                    <span>{feature}</span>
                    <span className="text-green-600">✓</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={`w-full rounded-lg py-3 text-center font-bold transition ${
                  selectedTier === tier.id ? "bg-brass text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {selectedTier === tier.id ? "مختار" : "اختر هذه الخطة"}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={handleSubscribe}
            disabled={loading}
            className="rounded-lg bg-brass px-12 py-4 text-lg font-bold text-white transition hover:bg-brass/90 disabled:opacity-60"
          >
            {loading ? "جارٍ المتابعة..." : "الذهاب للدفع"}
          </button>
        </div>
      </div>
    </div>
  );
}
