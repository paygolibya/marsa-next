"use client";

import { firePixelEvent, type PixelEventType } from "./ad-pixels";

// Fires one beacon at each of the 4 funnel moments this app tracks:
// pageview (every storefront page mount), add_to_cart (inside useCart's
// add/addBundle, so every call site gets this for free), checkout_started
// (checkout page mount), order_completed (confirmation page mount). Never
// awaited, never lets a tracking failure affect the real page — this is
// pure telemetry, not a feature the storefront depends on.
//
// Also fires the merchant's own configured ad pixels (Facebook/TikTok/
// Google Ads — see src/lib/ad-pixels.ts) for the 3 funnel moments that map
// onto a real conversion event. Bundled into this same call rather than
// threaded through every call site separately — same reasoning useCart's
// own add/addBundle already gives for firing trackEvent from inside the
// hook instead of at each "add to cart" button.
const SESSION_KEY = "marsa_session_id";

type TrackEventType = "pageview" | "add_to_cart" | "checkout_started" | "order_completed";

const PIXEL_EVENT_TYPES: Partial<Record<TrackEventType, PixelEventType>> = {
  add_to_cart: "add_to_cart",
  checkout_started: "checkout_started",
  order_completed: "purchase",
};

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private browsing / blocked storage — events still send, just
    // without a stable per-tab session id to group them by.
    return "unknown";
  }
}

export function trackEvent(
  storeSlug: string,
  type: TrackEventType,
  path: string,
  pixelData?: { valueCents?: number; currency?: string; transactionId?: string }
) {
  try {
    const body = JSON.stringify({
      storeSlug,
      type,
      path,
      referrer: document.referrer || undefined,
      sessionId: getSessionId(),
    });
    // sendBeacon survives the page unloading right after the call (the
    // common case for a pageview fired on mount, right before a buyer
    // clicks through) — fetch with keepalive is the fallback for browsers
    // without it.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/event", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/analytics/event", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Never let analytics break the actual page.
  }

  const pixelEvent = PIXEL_EVENT_TYPES[type];
  if (pixelEvent) {
    try {
      firePixelEvent(pixelEvent, pixelData);
    } catch {
      // Same rule as above — a third-party pixel script misbehaving must
      // never break the actual page either.
    }
  }
}
