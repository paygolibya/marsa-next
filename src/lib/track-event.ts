"use client";

// Fires one beacon at each of the 4 funnel moments this app tracks:
// pageview (every storefront page mount), add_to_cart (inside useCart's
// add/addBundle, so every call site gets this for free), checkout_started
// (checkout page mount), order_completed (confirmation page mount). Never
// awaited, never lets a tracking failure affect the real page — this is
// pure telemetry, not a feature the storefront depends on.
const SESSION_KEY = "marsa_session_id";

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

export function trackEvent(storeSlug: string, type: "pageview" | "add_to_cart" | "checkout_started" | "order_completed", path: string) {
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
}
