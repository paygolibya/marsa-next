"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store } from "@/lib/api";
import { SiteFooter } from "@/components/site-footer";

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

// A store-scoped version of the platform's generic /track page — the
// merchant's own colors/logo/footer style (already set in their design
// settings) apply here exactly like every other storefront page, so this
// page is "editable by the website owner" for free, with no new editor UI:
// changing store branding in /dashboard/design changes how this page looks
// too. The old global /track (no store context, no branding) stays as a
// fallback for links that predate this page.
export default function StoreTrackPage() {
  return (
    <Suspense fallback={null}>
      <StoreTrackPageContent />
    </Suspense>
  );
}

function StoreTrackPageContent() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [store, setStore] = useState<Store | null>(null);
  const [orderId, setOrderId] = useState(search.get("orderId") ?? "");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.publicStore(params.slug).then(({ store }) => setStore(store)).catch(() => {});
  }, [params.slug]);

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

  const primary = store?.customization?.primaryColor || "#0066cc";
  const secondary = store?.customization?.secondaryColor || "#f0f0f0";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: secondary }}>
      <main className="flex-1 mx-auto max-w-lg px-6 py-12 w-full">
        <Link href={`/store/${params.slug}`} className="text-sm text-rope hover:text-harbor">
          ← العودة إلى المتجر
        </Link>

        <div className="mt-6 rounded-2xl bg-white/90 shadow-xl p-8">
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
              style={{ backgroundColor: primary }}
              className="w-full rounded-full py-3 font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
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
              {result.scheduledStartAt && result.scheduledEndAt && (
                <Row
                  label="فترة الاستئجار"
                  value={`${new Date(result.scheduledStartAt).toLocaleDateString("ar-LY")} → ${new Date(result.scheduledEndAt).toLocaleDateString("ar-LY")}`}
                />
              )}
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

      <SiteFooter
        store={
          store?.customization?.footerStyle === "branded"
            ? { name: store.name, tagline: store.customization?.tagline, logo: store.customization?.logo }
            : undefined
        }
      />
    </div>
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
