"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import { api, formatLYD, type Store } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { trackEvent } from "@/lib/track-event";
import { isSupportedLanguage } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/useTranslation";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
};

export default function ConfirmationPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmationPageContent />
    </Suspense>
  );
}

function ConfirmationPageContent() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const [store, setStore] = useState<Store | null>(null);
  const cart = useCart(params.slug);

  useEffect(() => {
    api.publicStore(params.slug).then(({ store }) => setStore(store)).catch(() => {});
  }, [params.slug]);

  const orderId = search.get("orderId");

  // Only when a real order actually exists here (not the "no order to
  // show" fallback below) — this is the order_completed funnel moment,
  // reached only after a successful order creation.
  useEffect(() => {
    if (orderId) trackEvent(params.slug, "order_completed", `/store/${params.slug}/confirmation`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug, orderId]);

  // The COD/same-page Moamalat flow already clears the cart itself
  // (checkout/page.tsx's goToConfirmation) before navigating here, but the
  // apex-domain pay redirect (src/app/pay/[orderId]) lands here directly
  // without ever running that function — this covers that path too.
  // Clearing an already-empty cart is a harmless no-op either way.
  useEffect(() => {
    if (orderId) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const totalCents = Number(search.get("totalCents") ?? 0);
  const shippingCents = Number(search.get("shippingCents") ?? 0);
  const trackingId = search.get("trackingId");
  const courier = search.get("courier") ?? "";
  const paymentStatus = search.get("paymentStatus");
  const secondary = store?.customization?.secondaryColor || "#f0f0f0";
  const language = store && isSupportedLanguage(store.language) ? store.language : "ar";
  const { t } = useTranslation(language);

  if (!orderId) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: secondary }}>
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-harbor">{t("confirmation.noOrderHeading")}</h1>
          <Link href={`/store/${params.slug}`} className="text-brass font-bold mt-4 inline-block">
            {t("common.backToStore")}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      <main className="mx-auto max-w-lg px-6 py-20 text-center">
        <span className="stamp mx-auto mb-6 h-16 w-16 border-brass text-brass text-2xl font-bold">✓</span>
        <h1 className="font-display text-3xl font-extrabold text-harbor">{t("confirmation.heading")}</h1>
        <p className="text-rope mt-2">{t("confirmation.subtext")}</p>

        <dl className="mt-10 rounded-2xl border border-harbor/10 bg-white/50 p-6 text-right space-y-4">
          <Row label={t("confirmation.orderNumber")} value={orderId} mono />
          <Row label={t("confirmation.trackingNumber")} value={trackingId ?? t("common.dash")} mono />
          <Row label={t("confirmation.courier")} value={courierLabels[courier] ?? courier} />
          {shippingCents > 0 && <Row label={t("confirmation.shippingCost")} value={formatLYD(shippingCents, language)} />}
          <Row label={t("common.total")} value={formatLYD(totalCents, language)} />
          <Row label={t("confirmation.paymentStatus")} value={paymentStatus === "paid" ? t("confirmation.paid") : t("confirmation.pendingCod")} />
        </dl>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href={`/store/${params.slug}`}
            className="inline-block rounded-full bg-harbor text-canvas px-8 py-3 font-bold hover:bg-harbor-deep transition-colors"
          >
            {t("confirmation.continueShopping")}
          </Link>
          <Link
            href={`/store/${params.slug}/track?orderId=${orderId}`}
            className="inline-block rounded-full border border-harbor/20 px-8 py-3 font-bold text-harbor hover:bg-harbor/5 transition-colors"
          >
            {t("confirmation.trackOrder")}
          </Link>
        </div>
      </main>
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
