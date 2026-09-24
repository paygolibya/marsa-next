# Moamalat wallet payments (LightBox, direct)

Direct integration with [Moamalat](https://docs.moamalat.net)'s LightBox
checkout widget — replaces the DPay aggregator (see `docs/dpay.md` for why:
DPay's own Moamalat pass-through returned "Order Not Found" on Moamalat's
hosted page, an issue on their backend that direct integration sidesteps
entirely).

## Why this is shaped differently from DPay

LightBox has no server-side "open a session" REST call. Instead:

1. The server computes a signed config (merchant/terminal IDs, amount,
   a merchant reference, timestamp, HMAC) — the secret key never leaves
   the server.
2. The browser loads Moamalat's own `lightbox.js` and calls
   `Lightbox.Checkout.configure = {...}` / `showLightbox()` with that
   config. Moamalat's widget handles card entry, 3-D Secure/OTP, and
   everything else itself, inside its own hosted UI embedded in the page.
3. Moamalat tells the browser the result via `completeCallback` /
   `errorCallback` / `cancelCallback`, and *separately* notifies the server
   asynchronously (webhook). Same "whichever confirms first wins" race as
   DPay had, just triggered by the widget's own callback instead of an OTP
   form.

So the server's only three jobs are: sign the config, verify+relay the
client's completeCallback, and verify+process the async webhook. No
per-gateway table like DPay's 7 gateways — Moamalat's LightBox is card
payment only, one flow.

## SecureHash — the one algorithm used everywhere

Confirmed directly against docs.moamalat.net (introduction.html,
lightBox.html, notification.html, testData.html) — not guessed:

1. Take the relevant field names for the context (see below — the set
   differs between a request, the completeCallback response, the
   errorCallback response, and the server notification).
2. Sort the field **names** alphabetically.
3. Join as `name=value&name=value&...`.
4. HMAC-SHA256 that string using the **hex-decoded** secret key as the
   HMAC key.
5. Output as **uppercase hex**.

This exact recipe is implemented once, in `computeSecureHash()` inside
`src/lib/payment/moamalat-client.ts`, and reused for both signing (request)
and verifying (every response/callback/webhook) — never duplicated.

Field sets per context:
- **Request (LightBox config)**: `Amount, DateTimeLocalTrxn, MerchantId, MerchantReference, TerminalId`
- **completeCallback response**: every field Moamalat sends back except `SecureHash` itself (`TxnDate, SystemReference, NetworkReference, MerchantReference, Amount, Currency, PaidThrough, PayerAccount, PayerName, ProviderSchemeName`) — implemented generically (whatever keys are present, not a hardcoded list), since the docs describe it as "all response query string parameters except SecureHash."
- **errorCallback response**: `error, DateTimeLocalTrxn, MerchantReference, Amount`
- **Server notification (webhook)**: `DateTimeLocalTrxn, MerchantId, TerminalId, Amount, Currency` — notably **not** `MerchantReference`, unlike the request hash.

## The amount unit — the one detail that would be catastrophic to get wrong

Moamalat's `AmountTrxn` is in a different minor unit than the rest of this
codebase. Their own docs give the example **"1 Libyan dinar should be
1000"** — i.e. 1 LYD = 1000 units on their side, vs. this app's Int-cents
convention (1 LYD = 100 cents). The conversion is a flat `×10`
(`centsToMoamalatAmount()` in `moamalat-client.ts`), confirmed directly
from their docs rather than assumed. Getting this backwards would over- or
under-charge every real transaction by 10x.

## `TrxDateTime` format

`yyyyMMddHHmm` — exactly 12 characters, no seconds. Implemented in
`formatTrxDateTime()`.

## MerchantReference as the correlation key

LightBox has no session-ID concept the way DPay did — `MerchantReference`
is the one value Moamalat echoes back verbatim in every response and
notification, so it's used as the sole correlation key:
`order:<orderId>` for a buyer checkout order, `sub:<paymentId>` for a
merchant's own subscription payment. `makeOrderReference()` /
`makeSubscriptionReference()` / `parseMerchantReference()` in
`moamalat-client.ts`; `finalizeByMerchantReference()` in
`moamalat-dispatch.ts` dispatches to the right finalize function based on
the prefix.

## How a wallet checkout actually flows

1. Buyer picks "الدفع الإلكتروني" at checkout (Moamalat is the only wallet
   option — no gateway picker, unlike DPay's 7).
2. `POST /api/orders` creates the Order (`paymentStatus: "pending"`, same
   stock-decrement transaction as always), then calls
   `buildLightboxConfig()` and returns the signed config plus the
   environment-appropriate `lightbox.js` URL (`moamalatScriptUrl`) — no
   external HTTP call happens server-side, unlike DPay's session-open.
3. The browser loads `lightbox.js` (once per page — `loadLightboxScript()`
   in the checkout/payment pages guards against double-injection), sets
   `Lightbox.Checkout.configure`, and calls `showLightbox()`. Moamalat's
   own hosted UI takes over from there — card entry, OTP, everything.
4. `completeCallback` fires client-side the instant Moamalat's widget
   finishes → `POST /api/payments/moamalat/complete` relays every field it
   received. The route re-verifies `SecureHash` itself (never trusts the
   client's word alone) before calling `finalizeByMerchantReference()`.
5. `POST /api/moamalat/webhook` is Moamalat's own async server-to-server
   notification — the safety net if the buyer closes the tab right after
   paying, and (per Moamalat's docs) only ever fires for a completed
   transaction, so it always finalizes as `"paid"`.
6. Whichever of steps 4/5 confirms first wins: `finalizeWalletOrder()` /
   `finalizeSubscriptionPayment()` (`moamalat-order.ts` /
   `moamalat-subscription.ts`, both ported unchanged in logic from their
   DPay-era equivalents) use the same atomic
   `updateMany({ where: { paymentStatus: "pending" } })` guard DPay used —
   the loser is a safe no-op.

The webhook must respond with exactly `{"Message":"Success","Success":true}`
on success — a different shape from every other webhook in this codebase
(which use `{success:true}`), per Moamalat's docs.

## Mock mode

`isMoamalatConfigured()` (true only when `MOAMALAT_MERCHANT_ID`,
`MOAMALAT_TERMINAL_ID`, and `MOAMALAT_SECRET_KEY` are all set) gates wallet
availability in `/api/orders` and `/api/payments/moamalat/subscription-init`
— unconfigured means wallet checkout is simply not offered (a 400/503), not
a fake "paid" shortcut. No mock-payment path exists for Moamalat the way
DPay had one, since LightBox never made a mockable server-side call in the
first place.

## Data model

`Order` and `Payment` each gained `moamalatSystemReference` and
`moamalatNetworkReference` (Moamalat's own transaction references, stored
for reference/support — not used for anything logically). The old
`dpaySessionId`/`dpayPayMethod`/`dpayFeeCents` columns on both models are
kept in place, frozen, holding real historical DPay-era data — never
renamed or written to by any Moamalat code (see the comments on those
fields in `prisma/schema.prisma`). Likewise `Merchant.dpayEnabled` (now
generically "is wallet payment enabled") and `Merchant.dpayApiToken` (dead
— Moamalat uses one set of app-wide env credentials, not a per-merchant
token) keep their DPay-era column names for the same live-DB-rename-safety
reason.

## Credentials

Currently running on Moamalat's own **publicly published sandbox test
credentials** (from `docs.moamalat.net/testData.html` — not a secret, meant
for exactly this kind of testing):

- Merchant ID `10081014649`, Terminal ID `99179395`, secret key
  `3a488a89b3f7993476c252f017c488bb`, `MOAMALAT_ENV=test`.
- Test cards: `6395043835180860` (and 4 others in `.env`'s comment), expiry
  `01/27`, OTP `111111`.

Before accepting a real payment: replace all three env vars with real
production credentials issued by Moamalat's partner bank (not self-served —
unlike getting a DPay token), and flip `MOAMALAT_ENV` to `production` at the
same time — test and production use entirely different `lightbox.js` hosts
(`tnpg.moamalat.net:6006` vs `npg.moamalat.net:6006`), not just a flag on
the same one.

## Known limitations / things to revisit

- No automated end-to-end browser test against Moamalat's real sandbox
  LightBox widget has been run (would need a headless-browser flow driving
  real test-card entry) — verification so far covers the HMAC
  implementation and the server-side routes directly, not Moamalat's own
  hosted UI.
- Moamalat's real test/production environment may not be able to reach a
  local dev webhook URL (same restriction DPay had) — the webhook route's
  correctness was verified with a self-signed payload computing a real
  valid hash with the real test secret key, the same technique used for
  DPay's webhook.
- No refund/void handling exists yet, same gap DPay had.
- If a buyer abandons checkout after LightBox is shown but never completes,
  the order is left `pending` forever — nothing cleans this up (matches
  existing abandoned-COD-checkout behavior).
