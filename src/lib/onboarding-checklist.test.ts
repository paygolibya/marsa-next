import test from "node:test";
import assert from "node:assert/strict";
import { resolveChecklistSteps } from "./onboarding-checklist";
import type { Store } from "@/lib/api";

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: "store-1",
    merchantId: "merchant-1",
    name: "Test Store",
    slug: "test-store",
    theme: "souk",
    courier: "vanex",
    codEnabled: false,
    type: "physical",
    bookingSlotMinutes: null,
    bookingWorkingHours: null,
    walletProvider: null,
    currency: "LYD",
    createdAt: new Date().toISOString(),
    aboutText: null,
    returnPolicy: null,
    shippingPolicy: null,
    businessHours: null,
    language: "ar",
    supportedLanguages: ["ar"],
    customization: null,
    ...overrides,
  };
}

test("a physical store with no products/logo/payment has every applicable step undone", () => {
  const steps = resolveChecklistSteps(makeStore(), 0);
  assert.deepEqual(
    steps.map((s) => s.id),
    ["add-product", "customize-design", "enable-payment", "share-link"]
  );
  assert.equal(steps.find((s) => s.id === "add-product")!.done, false);
  assert.equal(steps.find((s) => s.id === "customize-design")!.done, false);
  assert.equal(steps.find((s) => s.id === "enable-payment")!.done, false);
  assert.equal(steps.find((s) => s.id === "share-link")!.done, undefined);
});

test("add-product flips to done once at least one product exists", () => {
  const steps = resolveChecklistSteps(makeStore(), 1);
  assert.equal(steps.find((s) => s.id === "add-product")!.done, true);
});

test("customize-design is done once a logo is set, regardless of other customization fields", () => {
  const store = makeStore({ customization: { logo: "https://example.com/logo.png" } as Store["customization"] });
  const steps = resolveChecklistSteps(store, 0);
  assert.equal(steps.find((s) => s.id === "customize-design")!.done, true);
});

test("enable-payment is done via codEnabled alone, or walletProvider alone", () => {
  assert.equal(resolveChecklistSteps(makeStore({ codEnabled: true }), 0).find((s) => s.id === "enable-payment")!.done, true);
  assert.equal(resolveChecklistSteps(makeStore({ walletProvider: "anis" }), 0).find((s) => s.id === "enable-payment")!.done, true);
  assert.equal(resolveChecklistSteps(makeStore({ codEnabled: false, walletProvider: null }), 0).find((s) => s.id === "enable-payment")!.done, false);
});

test("showcase stores never get a payment step at all (not just marked done)", () => {
  const steps = resolveChecklistSteps(makeStore({ type: "showcase" }), 0);
  assert.equal(steps.some((s) => s.id === "enable-payment"), false);
});

test("booking stores get an extra working-hours step, done once bookingWorkingHours is set", () => {
  const notSet = resolveChecklistSteps(makeStore({ type: "booking" }), 0);
  assert.ok(notSet.some((s) => s.id === "set-working-hours"));
  assert.equal(notSet.find((s) => s.id === "set-working-hours")!.done, false);

  const set = resolveChecklistSteps(makeStore({ type: "booking", bookingWorkingHours: { "1": { open: "09:00", close: "17:00" } } }), 0);
  assert.equal(set.find((s) => s.id === "set-working-hours")!.done, true);
});

test("non-booking store types never get the working-hours step", () => {
  for (const type of ["physical", "digital", "rental", "showcase"] as const) {
    const steps = resolveChecklistSteps(makeStore({ type }), 0);
    assert.equal(steps.some((s) => s.id === "set-working-hours"), false);
  }
});

test("the add-product step's copy is tailored per store type", () => {
  assert.equal(resolveChecklistSteps(makeStore({ type: "booking" }), 0).find((s) => s.id === "add-product")!.title, "أضف خدمتك الأولى");
  assert.equal(resolveChecklistSteps(makeStore({ type: "rental" }), 0).find((s) => s.id === "add-product")!.title, "أضف أول قطعة للتأجير");
  assert.equal(resolveChecklistSteps(makeStore({ type: "showcase" }), 0).find((s) => s.id === "add-product")!.title, "أضف أول عنصر للعرض");
  assert.equal(resolveChecklistSteps(makeStore({ type: "physical" }), 0).find((s) => s.id === "add-product")!.title, "أضف منتجك الأول");
});

test("share-link always points at the store's real subdomain", () => {
  const steps = resolveChecklistSteps(makeStore({ slug: "my-cool-store" }), 0);
  assert.equal(steps.find((s) => s.id === "share-link")!.ctaHref, "https://my-cool-store.rifqa.ly");
});
