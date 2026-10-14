import test from "node:test";
import assert from "node:assert/strict";
import { initAdPixels, firePixelEvent, _resetAdPixelsForTest } from "./ad-pixels";

// ad-pixels.ts reads bare `window`/`document` globals (guarded by
// `typeof window === "undefined"`, same pattern every other browser-only
// module in this codebase uses) — no jsdom dependency, just enough of a
// fake to exercise the real injection/firing logic. window/document are
// only ever read lazily, inside each function call, not at module load
// time, so installing the fakes per-test (not before import) is enough.
type FakeScript = { tagName: "SCRIPT"; async?: boolean; src?: string; onload?: () => void };

function installFakeDom() {
  const createdScripts: FakeScript[] = [];
  const fakeDocument = {
    createElement: (tag: string) => {
      const el: FakeScript = { tagName: tag.toUpperCase() as "SCRIPT" };
      return el;
    },
    head: {
      appendChild: (el: FakeScript) => {
        createdScripts.push(el);
      },
    },
  };
  (globalThis as any).document = fakeDocument;
  (globalThis as any).window = {};
  return { createdScripts, fakeWindow: (globalThis as any).window as Record<string, unknown> };
}

test("injects the Facebook pixel script and calls fbq init/PageView when facebookPixelId is configured", () => {
  _resetAdPixelsForTest();
  const { createdScripts, fakeWindow } = installFakeDom();
  initAdPixels({ facebookPixelId: "123456789" });
  assert.ok(createdScripts.some((s) => s.src?.includes("fbevents.js")));
  assert.equal(typeof fakeWindow.fbq, "function");
});

test("does not touch fbq at all when facebookPixelId isn't configured", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({});
  assert.equal(fakeWindow.fbq, undefined);
});

test("injecting the same Facebook pixel id twice only creates one script tag", () => {
  _resetAdPixelsForTest();
  const { createdScripts } = installFakeDom();
  initAdPixels({ facebookPixelId: "123456789" });
  initAdPixels({ facebookPixelId: "123456789" });
  assert.equal(createdScripts.filter((s) => s.src?.includes("fbevents.js")).length, 1);
});

test("injects the TikTok pixel and calls ttq.load/page when tiktokPixelId is configured", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({ tiktokPixelId: "C4A1B2C3" });
  const ttq = fakeWindow.ttq as { track: (...a: unknown[]) => void };
  assert.ok(ttq);
  assert.equal(typeof ttq.track, "function");
});

test("firePixelEvent calls fbq('track', 'AddToCart', ...) for add_to_cart when Facebook is configured", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({ facebookPixelId: "123456789" });
  const calls: unknown[][] = [];
  (fakeWindow.fbq as any) = (...args: unknown[]) => calls.push(args);
  firePixelEvent("add_to_cart", { valueCents: 5000, currency: "LYD" });
  assert.deepEqual(calls.at(-1), ["track", "AddToCart", { value: 50, currency: "LYD" }]);
});

test("firePixelEvent uses TikTok's CompletePayment event name (not Purchase) for the purchase moment", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({ tiktokPixelId: "C4A1B2C3" });
  const calls: unknown[][] = [];
  (fakeWindow.ttq as any).track = (...args: unknown[]) => calls.push(args);
  firePixelEvent("purchase", { valueCents: 10000 });
  assert.equal(calls.at(-1)?.[0], "CompletePayment");
});

test("firePixelEvent fires the Google Ads conversion only on purchase, and only when both id and label are set", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({ googleAdsConversionId: "AW-123", googleAdsConversionLabel: "AbCdEf" });
  const calls: unknown[][] = [];
  (fakeWindow.gtag as any) = (...args: unknown[]) => calls.push(args);

  firePixelEvent("add_to_cart", { valueCents: 5000 });
  assert.equal(calls.length, 0, "no conversion for add_to_cart");

  firePixelEvent("purchase", { valueCents: 10000, transactionId: "order-1" });
  const conversionCall = calls.find((c) => c[0] === "event" && c[1] === "conversion");
  assert.ok(conversionCall);
  assert.deepEqual(conversionCall![2], { send_to: "AW-123/AbCdEf", value: 100, currency: "LYD", transaction_id: "order-1" });
});

test("firePixelEvent never fires the Google Ads conversion when the label is missing", () => {
  _resetAdPixelsForTest();
  const { fakeWindow } = installFakeDom();
  initAdPixels({ googleAdsConversionId: "AW-123" });
  const calls: unknown[][] = [];
  (fakeWindow.gtag as any) = (...args: unknown[]) => calls.push(args);
  firePixelEvent("purchase", { valueCents: 10000 });
  assert.equal(calls.length, 0);
});

test("firePixelEvent is a silent no-op before initAdPixels has ever run", () => {
  _resetAdPixelsForTest();
  installFakeDom();
  assert.doesNotThrow(() => firePixelEvent("purchase", { valueCents: 10000 }));
});
