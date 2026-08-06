import test from "node:test";
import assert from "node:assert/strict";
import { getCheckoutPaymentMethods, getSubscriptionState } from "./checkout-features";

test("basic tier keeps manual methods enabled", () => {
  const state = getSubscriptionState({ subscriptionTier: "basic" });
  const methods = getCheckoutPaymentMethods(state);

  assert.equal(methods.directWire, true);
  assert.equal(methods.receiptUpload, true);
  assert.equal(methods.cod, true);
  assert.equal(methods.dpay, false);
});

test("professional tier can enable one automated method", () => {
  const state = getSubscriptionState({
    subscriptionTier: "professional",
    selectedPaymentMethod: "dpay",
    dpayEnabled: true,
  });
  const methods = getCheckoutPaymentMethods(state);

  assert.equal(methods.dpay, true);
  assert.equal(methods.directWire, false);
});

test("advanced tier enables all methods and API access", () => {
  const state = getSubscriptionState({ subscriptionTier: "advanced", dpayEnabled: true });
  const methods = getCheckoutPaymentMethods(state);

  assert.equal(methods.directWire, true);
  assert.equal(methods.receiptUpload, true);
  assert.equal(methods.cod, true);
  assert.equal(methods.dpay, true);
  assert.equal(state.apiAccessEnabled, true);
});
