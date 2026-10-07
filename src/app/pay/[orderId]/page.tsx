"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

// Moamalat's merchant-account domain whitelist rejects buyer checkout run
// from a store's own {slug}.rifqa.ly subdomain ("Invalid Domain", no card
// field at all — confirmed live, see docs/moamalat.md) but DOES accept the
// bare apex domain (confirmed live too, via the existing merchant-
// subscription payment page at /payment). Until Moamalat's own domain
// whitelist is fixed on their side, checkout redirects here — the bare
// apex domain — to actually run the Lightbox widget, then redirects back
// to the store's own confirmation/checkout page once it's done. This page
// intentionally has no store branding (colors/logo) — it's a brief,
// neutral hop, not a page a buyer is meant to notice or stay on.
declare global {
  interface Window {
    Lightbox?: {
      Checkout: {
        configure: Record<string, unknown>;
        showLightbox: () => void;
        closeLightbox: () => void;
      };
    };
  }
}

let lightboxScriptPromise: Promise<void> | null = null;
function loadLightboxScript(src: string): Promise<void> {
  if (window.Lightbox) return Promise.resolve();
  if (!lightboxScriptPromise) {
    lightboxScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load lightbox.js"));
      document.body.appendChild(script);
    });
  }
  return lightboxScriptPromise;
}

export default function PayPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [error, setError] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const config = await api.moamalatPayConfig(orderId);
        if (cancelled) return;
        setStoreSlug(config.storeSlug);

        await loadLightboxScript(config.moamalatScriptUrl);
        if (cancelled) return;

        const checkoutUrl = `https://${config.storeSlug}.rifqa.ly/store/${config.storeSlug}/checkout`;
        const confirmationUrl = (params: URLSearchParams) =>
          `https://${config.storeSlug}.rifqa.ly/store/${config.storeSlug}/confirmation?${params.toString()}`;

        window.Lightbox!.Checkout.configure = {
          MID: config.moamalat.MID,
          TID: config.moamalat.TID,
          AmountTrxn: config.moamalat.AmountTrxn,
          MerchantReference: config.moamalat.MerchantReference,
          TrxDateTime: config.moamalat.TrxDateTime,
          SecureHash: config.moamalat.SecureHash,
          completeCallback: async (data: Record<string, string>) => {
            try {
              const completeResult = await api.moamalatComplete(data);
              if (completeResult.status === "paid") {
                window.location.href = confirmationUrl(
                  new URLSearchParams({
                    orderId,
                    totalCents: String(config.totalCents),
                    shippingCents: String(config.shippingCents),
                    trackingId: completeResult.trackingId ?? "",
                    courier: completeResult.courier ?? "",
                    paymentStatus: "paid",
                  })
                );
                return;
              }
              window.location.href = `${checkoutUrl}?paymentError=1`;
            } catch {
              window.location.href = `${checkoutUrl}?paymentError=1`;
            }
          },
          errorCallback: () => {
            window.location.href = `${checkoutUrl}?paymentError=1`;
          },
          cancelCallback: () => {
            window.location.href = checkoutUrl;
          },
        };
        window.Lightbox!.Checkout.showLightbox();
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "تعذّر بدء عملية الدفع");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-harbor px-6 text-center">
      {error ? (
        <div>
          <p className="text-white font-bold mb-2">{error}</p>
          {storeSlug && (
            <a href={`https://${storeSlug}.rifqa.ly/store/${storeSlug}/checkout`} className="text-white/70 underline text-sm">
              العودة لإتمام الطلب
            </a>
          )}
        </div>
      ) : (
        <p className="text-white/80">جارٍ تجهيز صفحة الدفع...</p>
      )}
    </main>
  );
}
