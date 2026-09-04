import test from "node:test";
import assert from "node:assert/strict";
import { getCheckoutPaymentMethods, getSubscriptionState, subscriptionPeriods } from "./checkout-features";

// There's only one plan now — every tier string on record (old data) or
// passed in resolves to the same full feature set.
test("every tier gets every payment method enabled", () => {
  for (const tier of ["basic", "professional", "advanced"] as const) {
    const state = getSubscriptionState({ subscriptionTier: tier });
    const methods = getCheckoutPaymentMethods(state);

    assert.equal(methods.directWire, true);
    assert.equal(methods.receiptUpload, true);
    assert.equal(methods.cod, true);
    assert.equal(methods.dpay, true);
    assert.equal(state.apiAccessEnabled, true);
    assert.equal(state.allowMultiplePaymentMethods, true);
  }
});

test("an explicit false flag on the merchant row still overrides the default", () => {
  // getSubscriptionState only falls back to the plan default when the
  // merchant's own flag is null/undefined — an admin who explicitly
  // disabled a flag on one merchant should still see that respected.
  const state = getSubscriptionState({ subscriptionTier: "advanced", dpayEnabled: false });
  assert.equal(state.dpayEnabled, false);
});

test("billing periods price out to the advertised monthly equivalent", () => {
  assert.equal(subscriptionPeriods["1m"].monthlyEquivalentLYD, 150);
  assert.equal(subscriptionPeriods["3m"].monthlyEquivalentLYD, 133);
  assert.equal(subscriptionPeriods["12m"].monthlyEquivalentLYD, 125);
});
