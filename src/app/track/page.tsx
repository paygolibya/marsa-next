"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { api, ApiError, formatLYD } from "@/lib/api";

const statusLabels: Record<string, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

const courierStatusLabels: Record<string, string> = {
  accepted: "مستلمة من المخزن",
  delivered: "تم التسليم",
  failed_delivery: "فشل التسليم",
  returned: "مرتجعة",
};

type TrackResult = Awaited<ReturnType<typeof api.trackOrder>>;

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackPageContent />
    </Suspense>
  );
}

function TrackPageContent() {
  const search = useSearchParams();
  const [orderId, setOrderId] = useState(search.get("orderId") ?? "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = search.get("orderId");
    if (id) setOrderId(id);
  }, [search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await api.trackOrder(orderId.trim(), phone.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر العثور على الطلب");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-2xl bg-white/90 shadow-xl p-8">
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">تتبع طلبك</h1>
        <p className="text-rope mb-8">أدخل رقم الطلب ورقم الهاتف المستخدم عند الشراء.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الطلب</span>
            <input required dir="ltr" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input font-mono" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </label>
          {error && <p className="text-signal text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ البحث..." : "تتبع"}
          </button>
        </form>

        {result && (
          <div className="mt-10 rounded-2xl border border-harbor/10 bg-white/90 p-6 space-y-4 text-right">
            <Row label="حالة الطلب" value={statusLabels[result.status] ?? result.status} />
            {result.courierStatus && (
              <Row label="حالة الشحنة" value={courierStatusLabels[result.courierStatus] ?? result.courierStatus} />
            )}
            {result.courierTrackingId && <Row label="رقم التتبع" value={result.courierTrackingId} mono />}
            {result.courierNote && <Row label="ملاحظة الشحن" value={result.courierNote} />}
            <Row label="الإجمالي" value={formatLYD(result.totalCents)} />

            <div className="border-t border-harbor/10 pt-4">
              <p className="text-sm font-bold text-harbor mb-2">المنتجات</p>
              <ul className="space-y-1 text-sm text-rope">
                {result.items.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>
                      {item.productName}
                      {item.variantLabel && <span className="text-xs opacity-70"> ({item.variantLabel})</span>} × {item.quantity}
                    </span>
                    <span>{formatLYD(item.unitPriceCents * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        </div>
      </main>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-rope text-sm">{label}</dt>
      <dd className={`font-bold text-harbor text-sm ${mono ? "font-mono" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
