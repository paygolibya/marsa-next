import test from "node:test";
import assert from "node:assert/strict";
import { trackEvent } from "./track-event";
import { initAdPixels, _resetAdPixelsForTest } from "./ad-pixels";

// Same fake-browser-globals approach as ad-pixels.test.ts — trackEvent
// also touches sessionStorage/document/navigator (for its own first-party
// beacon, unrelated to this file's actual focus: verifying it correctly
// dispatches to firePixelEvent for the 3 funnel moments that map onto a
// real ad-pixel conversion, and skips it for "pageview").
function installFakeBrowserGlobals() {
  const sentBeacons: unknown[] = [];
  (globalThis as any).window = {};
  (globalThis as any).document = { referrer: "", createElement: () => ({}), head: { appendChild: () => {} } };
  (globalThis as any).sessionStorage = {
    store: new Map<string, string>(),
    getItem(k: string) {
      return this.store.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      this.store.set(k, v);
    },
  };
  // Node has its own built-in, read-only `navigator` global — a plain
  // assignment throws ("has only a getter"), so this needs defineProperty
  // to actually replace it.
  Object.defineProperty(globalThis, "navigator", {
    value: {
      sendBeacon: (_url: string, body: unknown) => {
        sentBeacons.push(body);
        return true;
      },
    },
    configurable: true,
    writable: true,
  });
  return { sentBeacons };
}

test("fires AddToCart on the configured pixels for an add_to_cart event", () => {
  _resetAdPixelsForTest();
  installFakeBrowserGlobals();
  const fakeWindow = (globalThis as any).window;
  initAdPixels({ facebookPixelId: "123456789" });
  const calls: unknown[][] = [];
  fakeWindow.fbq = (...args: unknown[]) => calls.push(args);

  trackEvent("my-store", "add_to_cart", "/store/my-store", { valueCents: 5000 });

  assert.deepEqual(calls.at(-1), ["track", "AddToCart", { value: 50, currency: "LYD" }]);
});

test("fires InitiateCheckout for a checkout_started event", () => {
  _resetAdPixelsForTest();
  installFakeBrowserGlobals();
  const fakeWindow = (globalThis as any).window;
  initAdPixels({ facebookPixelId: "123456789" });
  const calls: unknown[][] = [];
  fakeWindow.fbq = (...args: unknown[]) => calls.push(args);

  trackEvent("my-store", "checkout_started", "/store/my-store/checkout");

  assert.equal(calls.at(-1)?.[1], "InitiateCheckout");
});

test("fires Purchase for an order_completed event", () => {
  _resetAdPixelsForTest();
  installFakeBrowserGlobals();
  const fakeWindow = (globalThis as any).window;
  initAdPixels({ facebookPixelId: "123456789" });
  const calls: unknown[][] = [];
  fakeWindow.fbq = (...args: unknown[]) => calls.push(args);

  trackEvent("my-store", "order_completed", "/store/my-store/confirmation", { valueCents: 20000, transactionId: "order-1" });

  assert.equal(calls.at(-1)?.[1], "Purchase");
});

test("never fires any pixel event for a plain pageview", () => {
  _resetAdPixelsForTest();
  installFakeBrowserGlobals();
  const fakeWindow = (globalThis as any).window;
  initAdPixels({ facebookPixelId: "123456789" });
  const calls: unknown[][] = [];
  fakeWindow.fbq = (...args: unknown[]) => calls.push(args);

  trackEvent("my-store", "pageview", "/store/my-store");

  assert.equal(calls.length, 0);
});

test("still sends the first-party analytics beacon regardless of pixel configuration", () => {
  _resetAdPixelsForTest();
  const { sentBeacons } = installFakeBrowserGlobals();

  trackEvent("my-store", "pageview", "/store/my-store");

  assert.equal(sentBeacons.length, 1);
});
