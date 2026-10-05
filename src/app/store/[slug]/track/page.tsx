"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store } from "@/lib/api";
import { SiteFooter } from "@/components/site-footer";
import { isSupportedLanguage } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/useTranslation";

const statusKeys: Record<string, string> = {
  pending: "track.statusPending",
  confirmed: "track.statusConfirmed",
  shipped: "track.statusShipped",
  delivered: "track.statusDelivered",
  cancelled: "track.statusCancelled",
};

const courierStatusKeys: Record<string, string> = {
  accepted: "track.courierAccepted",
  delivered: "track.courierDelivered",
  failed_delivery: "track.courierFailed",
  returned: "track.courierReturned",
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
  const language = store && isSupportedLanguage(store.language) ? store.language : "ar";
  const { t } = useTranslation(language);

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
      setError(err instanceof ApiError ? err.message : t("track.orderNotFound"));
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
          {t("common.backToStoreLink")}
        </Link>

        <div className="mt-6 rounded-2xl bg-white/90 shadow-xl p-8">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">{t("track.heading")}</h1>
          <p className="text-rope mb-8">{t("track.instructions")}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("product.orderIdPlaceholder")}</span>
              <input required dir="ltr" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input font-mono" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("product.phonePlaceholder")}</span>
              <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </label>
            {error && <p className="text-signal text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: primary }}
              className="w-full rounded-full py-3 font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? t("track.searching") : t("track.trackButton")}
            </button>
          </form>

          {result && (
            <div className="mt-10 rounded-2xl border border-harbor/10 bg-white/90 p-6 space-y-4 text-right">
              <Row label={t("track.orderStatus")} value={statusKeys[result.status] ? t(statusKeys[result.status]) : result.status} />
              {result.courierStatus && (
                <Row label={t("track.shipmentStatus")} value={courierStatusKeys[result.courierStatus] ? t(courierStatusKeys[result.courierStatus]) : result.courierStatus} />
              )}
              {result.courierTrackingId && <Row label={t("confirmation.trackingNumber")} value={result.courierTrackingId} mono />}
              {result.courierNote && <Row label={t("track.courierNote")} value={result.courierNote} />}
              {store?.type === "booking" && result.scheduledStartAt && (
                // Sliced from the ISO string directly, not toLocaleString
                // — see src/lib/booking.ts's module comment on why.
                <Row label={t("track.appointment")} value={`${result.scheduledStartAt.slice(0, 10)} — ${result.scheduledStartAt.slice(11, 16)}`} />
              )}
              {store?.type === "rental" && result.scheduledStartAt && result.scheduledEndAt && (
                <Row
                  label={t("track.rentalPeriod")}
                  value={`${new Date(result.scheduledStartAt).toLocaleDateString(language === "en" ? "en-US" : "ar-LY")} → ${new Date(result.scheduledEndAt).toLocaleDateString(language === "en" ? "en-US" : "ar-LY")}`}
                />
              )}
              <Row label={t("common.total")} value={formatLYD(result.totalCents, language)} />

              <div className="border-t border-harbor/10 pt-4">
                <p className="text-sm font-bold text-harbor mb-2">{t("track.products")}</p>
                <ul className="space-y-1 text-sm text-rope">
                  {result.items.map((item) => (
                    <li key={item.id} className="flex justify-between">
                      <span>
                        {item.productName}
                        {item.variantLabel && <span className="text-xs opacity-70"> ({item.variantLabel})</span>} × {item.quantity}
                      </span>
                      <span>{formatLYD(item.unitPriceCents * item.quantity, language)}</span>
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
        language={language}
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
