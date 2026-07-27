"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function SubscriptionPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [selectedTier, setSelectedTier] = useState<"starter" | "professional" | "advanced">("starter");
  const [loading, setLoading] = useState(false);

  const tiers: Array<{
    id: "starter" | "professional" | "advanced";
    name: string;
    price: number;
    features: string[];
    recommended?: boolean;
  }> = [
    {
      id: "starter",
      name: "المبتدئ (Starter)",
      price: 150,
      features: ["متجر واحد", "حتى 100 منتج", "حتى 150 طلب/شهر", "دعم البريد الإلكتروني"],
    },
    {
      id: "professional",
      name: "المتقدم (Professional)",
      price: 280,
      features: ["3 متاجر", "حتى 500 منتج", "حتى 600 طلب/شهر", "نطاق مخصص", "دعم الأولوية", "توصيل تلقائي"],
      recommended: true,
    },
    {
      id: "advanced",
      name: "الاحترافي (Advanced)",
      price: 450,
      features: ["متاجر غير محدودة", "منتجات غير محدودة", "طلبات غير محدودة", "دعم VIP", "تحليلات متقدمة", "مستودعات متعددة"],
    },
  ];

  const handleSubscribe = async () => {
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: selectedTier }),
      });

      if (response.ok) {
        router.push("/dashboard");
      }
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

              <h3 className="mb-2 text-right text-2xl font-bold">{tier.name}</h3>
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
            {loading ? "جارٍ المتابعة..." : "متابعة للدفع"}
          </button>
        </div>
      </div>
    </div>
  );
}
