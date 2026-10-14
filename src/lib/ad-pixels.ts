"use client";

// Merchant-configured third-party ad pixels (Facebook, TikTok, Google
// Ads) — a separate concern from src/lib/track-event.ts's own first-party
// AnalyticsEvent beacons. initAdPixels() injects each platform's script
// once per pixel id (idempotent — safe to call on every page that loads
// store data, which is exactly how it's used: see each store/[slug]/*
// page's own useEffect). firePixelEvent() is called from the same funnel
// moments trackEvent() already is (add_to_cart/checkout_started/purchase),
// and silently no-ops for any pixel the merchant hasn't configured.

export type PixelConfig = {
  facebookPixelId?: string | null;
  tiktokPixelId?: string | null;
  googleAdsConversionId?: string | null;
  googleAdsConversionLabel?: string | null;
};

export type PixelEventType = "add_to_cart" | "checkout_started" | "purchase";

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string };
    _fbq?: unknown;
    ttq?: { track: (event: string, data?: Record<string, unknown>) => void; load: (id: string) => void; page: () => void };
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Standard event names differ per platform — Facebook/TikTok use "Purchase"
// vs "CompletePayment" for the same funnel moment, for example.
const FACEBOOK_EVENT_NAMES: Record<PixelEventType, string> = {
  add_to_cart: "AddToCart",
  checkout_started: "InitiateCheckout",
  purchase: "Purchase",
};
const TIKTOK_EVENT_NAMES: Record<PixelEventType, string> = {
  add_to_cart: "AddToCart",
  checkout_started: "InitiateCheckout",
  purchase: "CompletePayment",
};

let active: PixelConfig | null = null;
const injectedKeys = new Set<string>();

export function initAdPixels(config: PixelConfig) {
  active = config;
  if (typeof window === "undefined") return;

  if (config.facebookPixelId && !injectedKeys.has(`fb:${config.facebookPixelId}`)) {
    injectedKeys.add(`fb:${config.facebookPixelId}`);
    injectFacebookPixel(config.facebookPixelId);
  }
  if (config.tiktokPixelId && !injectedKeys.has(`tt:${config.tiktokPixelId}`)) {
    injectedKeys.add(`tt:${config.tiktokPixelId}`);
    injectTikTokPixel(config.tiktokPixelId);
  }
  if (config.googleAdsConversionId && !injectedKeys.has(`ga:${config.googleAdsConversionId}`)) {
    injectedKeys.add(`ga:${config.googleAdsConversionId}`);
    injectGoogleAdsTag(config.googleAdsConversionId);
  }
}

// Adapted from Facebook's own fbevents.js snippet — functionally
// unchanged, just typed instead of the usual untyped IIFE.
function injectFacebookPixel(pixelId: string) {
  if (window.fbq) {
    window.fbq("init", pixelId);
    return;
  }
  const fbq: NonNullable<Window["fbq"]> = function (...args: unknown[]) {
    const q = (fbq as any).queue as unknown[];
    q.push(args);
  } as NonNullable<Window["fbq"]>;
  (fbq as any).queue = [];
  (fbq as any).loaded = true;
  (fbq as any).version = "2.0";
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

// Adapted from TikTok's own ttq snippet.
function injectTikTokPixel(pixelId: string) {
  if (window.ttq) {
    window.ttq.load(pixelId);
    window.ttq.page();
    return;
  }
  const queue: [string, unknown[]][] = [];
  const stub = {
    track: (event: string, data?: Record<string, unknown>) => queue.push(["track", [event, data]]),
    load: (id: string) => queue.push(["load", [id]]),
    page: () => queue.push(["page", []]),
  };
  window.ttq = stub;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${pixelId}&lib=ttq`;
  script.onload = () => {
    // The real library replaces window.ttq itself once loaded; replay
    // whatever was queued against the stub before that happened.
    for (const [method, args] of queue) {
      (window.ttq as any)?.[method]?.(...args);
    }
  };
  document.head.appendChild(script);
  stub.load(pixelId);
  stub.page();
}

function injectGoogleAdsTag(conversionId: string) {
  if (window.gtag) {
    window.gtag("config", conversionId);
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(script);
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", conversionId);
}

export function firePixelEvent(event: PixelEventType, data?: { valueCents?: number; currency?: string; transactionId?: string }) {
  if (typeof window === "undefined" || !active) return;
  const value = data?.valueCents != null ? data.valueCents / 100 : undefined;
  const currency = data?.currency ?? "LYD";

  if (active.facebookPixelId && window.fbq) {
    window.fbq("track", FACEBOOK_EVENT_NAMES[event], value != null ? { value, currency } : undefined);
  }
  if (active.tiktokPixelId && window.ttq) {
    window.ttq.track(TIKTOK_EVENT_NAMES[event], value != null ? { value, currency } : undefined);
  }
  // Google Ads has no generic "standard events" the way Facebook/TikTok
  // do — just the one conversion action a merchant sets up in their
  // account, almost always tied to a completed purchase.
  if (event === "purchase" && active.googleAdsConversionId && active.googleAdsConversionLabel && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${active.googleAdsConversionId}/${active.googleAdsConversionLabel}`,
      value,
      currency,
      transaction_id: data?.transactionId,
    });
  }
}

// Test-only: resets module state between tests (ad-pixels.test.ts), since
// `active`/`injectedKeys` otherwise persist for the life of the module.
export function _resetAdPixelsForTest() {
  active = null;
  injectedKeys.clear();
}
