import test from "node:test";
import assert from "node:assert/strict";
import { conversionStage, followUpMessage, whatsappLink, whatsappNumber } from "./conversion";

const store = (o: Partial<{ type: string; products: number; orders: number; bookableHours: boolean }> = {}) => ({
  type: "physical",
  products: 3,
  orders: 2,
  bookableHours: false,
  ...o,
});

test("stages follow the funnel in order", () => {
  assert.equal(conversionStage({ phoneVerified: false, approvedPayments: 0, store: null }), "not_verified");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 0, store: null }), "no_store");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 0, store: store({ products: 0 }) }), "no_products");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 0, store: store({ type: "booking" }) }), "booking_no_hours");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 0, store: store({ orders: 0 }) }), "no_orders");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 0, store: store() }), "selling");
  assert.equal(conversionStage({ phoneVerified: true, approvedPayments: 1, store: store() }), "paid");
});

test("Libyan local numbers become WhatsApp international digits", () => {
  assert.equal(whatsappNumber("0920281599"), "218920281599");
  assert.equal(whatsappNumber("00218920281599"), "218920281599");
});

test("near the trial end, a working store gets the subscribe message with the payment link", () => {
  const msg = followUpMessage("Besha store", "no_orders", 5);
  assert.match(msg, /أهلًا Besha/);
  assert.match(msg, /تنتهي خلال 5 أيام/);
  assert.match(msg, /75 د.ل/);
  assert.match(msg, /rifqa\.ly\/payment\?period=1m/);
});

test("early on, the message is about the next activation step, not payment", () => {
  assert.doesNotMatch(followUpMessage("Ali", "no_products", 40), /payment/);
  assert.match(followUpMessage("Ali", "no_products", 40), /ننزلها لك مجانًا/);
});

test("wa.me link carries the encoded message", () => {
  const link = whatsappLink("0920281599", "أهلًا");
  assert.ok(link.startsWith("https://wa.me/218920281599?text="));
  assert.equal(decodeURIComponent(link.split("text=")[1]), "أهلًا");
});
