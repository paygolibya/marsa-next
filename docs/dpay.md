# DPay wallet payments

Real integration with [DPay](https://dpay.ly) (`https://dpay.ly/api`), the
aggregator Rifqa routes every "wallet" checkout through. One session-based
flow covers 7 gateways — the buyer picks one at checkout, not us:

| `pay_method`  | Rail                              | Extra fields required     |
|---------------|------------------------------------|----------------------------|
| `edfali`      | Edfali mobile wallet                | `customer_mobile`          |
| `sadad`       | Sadad (Almadar Aljadid) wallet      | `customer_mobile`, `birth_year` |
| `masrefypay`  | Bank card — Jumhouria Bank          | `card_number`              |
| `yousrpay`    | Bank card — National Commercial Bank| `card_number`              |
| `saharapay`   | Bank card — Sahara Bank             | `card_number`              |
| `mobicash`    | MobiCash card payment               | `card_number`              |
| `moamalat`    | Card via hosted LightBox            | none — redirect only       |

## Why this isn't a simple synchronous "charge and get a result" call

Every gateway except Moamalat needs the buyer to enter an OTP DPay texts
them directly — we never see the code ourselves until the buyer types it
back into our checkout. Moamalat instead returns a hosted `payment_link`
the buyer is redirected to. Neither shape fits the old
`initiateWalletPayment()` mock this replaces (which just returned
`paid`/`failed` synchronously) — so the whole wallet checkout path in
`/api/orders` had to change from "resolve payment, then respond" to
"open a session, respond with what the buyer needs to do next."

## The contract, as actually confirmed (not just documented)

DPay's own docs describe `POST /payment/sessions/open` but never state the
verify endpoint's path. It was found by probing the live API with a real
token: `POST /payment/sessions/verify` returned `422` ("The selected
session id is invalid") for a garbage id, while every other guessed path
(`/payment/sessions/{id}/verify`, `/payment/sessions/{id}/confirm`, etc.)
returned `405`. Also confirmed live:

- Opening a real `moamalat` session returns exactly the documented shape,
  including the absolute `payment_link`.
- Opening a session for a gateway the merchant hasn't configured in their
  DPay dashboard (e.g. `edfali` without a mobile+PIN on file) fails with a
  clear `422` and a human-readable message — not a code bug, an account
  setup step the merchant does in DPay's own dashboard (Pay Methods).
- `amount` is a plain LYD decimal (e.g. `1500` for 1500 LYD) — **not**
  cents, and **not** Moamalat's own "dirham" minor unit (1 LYD = 1000
  dirham) that a mobile SDK doc mentioned earlier in this project's
  history. DPay abstracts that away entirely; `centsToLyd()` in
  `dpay-client.ts` is the one place this conversion happens.
- The webhook HMAC scheme (`hmac_sha256(timestamp + '.' + rawBody,
  secret)`, hex, constant-time compared, timestamp rejected past 5
  minutes) was verified against a self-signed test payload — see
  "Verification" below — since DPay can't deliver a real webhook to
  localhost (documented: they block localhost/private IPs at delivery
  time).

## How a wallet checkout actually flows

1. Buyer picks "الدفع الإلكتروني" and a specific gateway at checkout,
   fills in whatever that gateway needs (mobile, birth year, or card
   number — see the table above).
2. `POST /api/orders` creates the Order (`paymentStatus: "pending"`, same
   stock-decrement transaction as always), then calls
   `openDpaySession()`. The session id, chosen gateway, and DPay's fee are
   stored on the order (`dpaySessionId`, `dpayPayMethod`, `dpayFeeCents`).
3. Response tells the frontend what to do next:
   - Moamalat → redirect the browser to `payment_link`.
   - Everything else → show an OTP input.
4. Non-Moamalat: `POST /api/dpay/verify-otp` with `{ orderId, otp }` calls
   DPay's verify endpoint and relays the result immediately.
5. Whichever confirms the payment first — the verify call above, or DPay's
   webhook — calls `finalizeWalletOrder()` (`src/lib/payment/dpay-order.ts`),
   the **one** place `paymentStatus` is written and the Vanex shipment is
   created for a wallet order. The other confirmation becomes a no-op: the
   `updateMany({ where: { paymentStatus: "pending" } })` guard only lets
   the first caller through.
6. `POST /api/dpay/webhook` is the sole confirmation path for Moamalat
   (no verify step exists for it) and the safety net for everything else
   (e.g. the buyer closes the tab right after entering their OTP).

Mock mode (`DPAY_API_TOKEN` unset) collapses all of this back to the old
behavior — `openDpaySession()` returns `status: "paid"` immediately, so
`/api/orders` falls through to the same shared shipment-creation code COD
uses, and no OTP/redirect step ever appears in the UI.

## Data model

`Order` gains `dpaySessionId` (`@unique` — also doubles as protection
against ever opening two DPay sessions for the same order), `dpayPayMethod`,
and `dpayFeeCents` (DPay's own cut, logged for reference — separate from
and unrelated to Rifqa's own 1% commission in `src/lib/payment/commission.ts`,
which is computed from `Order.totalCents`, not affected by DPay's fee).

## Second use: merchants paying their own subscription instantly

The exact same session/OTP/webhook machinery also powers `/payment`'s
"⚡ الدفع الفوري عبر DPay" — a merchant paying their *own* subscription
fee, real-time, instead of uploading a bank transfer receipt and waiting
for an admin. This was built after the buyer-checkout flow above, reusing
it rather than duplicating it:

- `openDpaySession`'s `data` param generalizes to `{ order_id }` **or**
  `{ payment_id }` — one webhook URL, one DPay account, both flows funnel
  through `/api/dpay/webhook`, which branches on which key is present.
- `src/lib/payment/dpay-subscription.ts`'s `finalizeSubscriptionPayment`
  mirrors `finalizeWalletOrder`'s exact shape (same atomic
  `status: "pending"` guard, callable from both the OTP-verify route and
  the webhook) — and mirrors `/api/admin/payments/[id]/approve`'s exact
  activation logic (`subscriptionTier`/`subscriptionStatus`/
  `subscriptionEndDate`/`getPlanFeatureFlags`), just triggered
  automatically instead of by an admin's click.
- `Payment` gained the same three DPay fields `Order` has
  (`dpaySessionId`/`dpayPayMethod`/`dpayFeeCents`), plus `method`
  (`'bank_transfer' | 'dpay'`) to tell the two payment paths apart.
  `Payment.amount` stays in whole LYD (that model's existing convention,
  predating this work) — only converted to cents at the `openDpaySession`
  call site, same as everywhere else that talks to DPay.
- The manual receipt-upload path was untouched at the time this was
  written — a new alternative on the same page, not a replacement. **No
  longer true**: once DPay was confirmed working end to end, the
  receipt-upload flow was removed entirely (see `docs/subscriptions.md`)
  — `/payment` is DPay-only now, DPay isn't "an alternative" anymore.

The *other* DPay-labeled control that used to sit on the same page (for
the professional tier: which checkout method the merchant's own store
offers its customers) predates any real DPay integration and has
nothing to do with paying the subscription itself — see
`docs/subscriptions.md` for why tiers (and that control) don't exist
anymore either.

## Idempotency and races

- `finalizeWalletOrder`'s `updateMany` guard (`paymentStatus: "pending"` in
  the `where`) is the actual concurrency guard, not an application-level
  check-then-write — safe even if the OTP-verify response and the webhook
  arrive within milliseconds of each other.
- The webhook handler deliberately does **not** swallow a processing
  failure into a `200` (unlike the Vanex webhook, which does for a
  different reason — one bad package in a multi-package batch). Here
  there's exactly one event to get right per delivery, so a genuine
  failure returns `500` and lets DPay's own retry (5 attempts,
  exponential backoff up to 1h) try again.

## Known limitations / things to revisit

- `payment.refunded` and `payment.voided` are logged, not acted on — no
  automatic shipment-cancellation or payout-reversal exists yet. A refund
  after a payout has already been calculated/paid out to the merchant
  (see `docs/payouts.md`) needs a manual reconciliation process this
  integration doesn't attempt to automate.
- If a buyer abandons checkout after `/api/orders` already opened a real
  DPay session, that order is left `pending` forever (mirrors how an
  abandoned COD checkout already behaves — nothing cleans either up).
- Per-project API token pinning (mentioned in DPay's webhook docs) isn't
  used — Rifqa runs one DPay account/token for the whole platform, matching
  how the centralized payout system already assumes one Rifqa-side account
  for all merchant wallet payments.

## Verification

Live-tested directly against `https://dpay.ly/api` with the real account
token (not just curl — the actual `dpay-client.ts` functions):
- `openDpaySession({ payMethod: "moamalat", ... })` → real `session_id`,
  correct `amount`/fee parsing, real `payment_link`.
- `openDpaySession({ payMethod: "edfali", ... })` on an unconfigured
  gateway → `DpayApiError` with DPay's own message, not a crash.
- `verifyDpaySession()` against a garbage session id → `DpayApiError`
  ("invalid session id"), confirming the verify endpoint's real path.
- `verifyDpayWebhookSignature()` unit-tested standalone (no network): a
  valid fresh signature passes; a tampered body, wrong secret, garbage
  signature, missing signature, and a stale (10-minute-old) timestamp all
  correctly fail; a 4-minute-old signature (within the 5-minute window)
  correctly passes.

Also live-verified end to end once the database was reachable again
(migration applied, real order row, real DPay session, self-signed
webhook simulating what DPay would deliver — DPay itself can't reach
localhost, see their docs' delivery restrictions):
- `POST /api/orders` with `paymentMethod: "wallet"`, `dpayPayMethod:
  "moamalat"` → real DPay session opened, `dpaySessionId`/`dpayPayMethod`/
  `dpayFeeCents` stored, `paymentStatus` stays `pending`,
  `courierTrackingId` stays null (shipment correctly deferred).
- A self-signed `payment.paid` webhook (HMAC computed the same way DPay's
  docs specify) → `finalizeWalletOrder` flips `paymentStatus` to `paid`,
  `status` to `confirmed`, and creates a real courier shipment — all in
  one call, exactly as designed.
- A webhook with a wrong signature → rejected with `401`, never reaches
  the order-processing code at all.
- A second, duplicate delivery of the same `payment.paid` event → `200`
  success but a genuine no-op: `courierTrackingId` unchanged, no second
  shipment or notification — confirming the `updateMany({ where:
  paymentStatus: "pending" }})` guard actually holds under a repeat
  delivery, not just in theory.

Not yet verified — a real OTP round trip against any of the 6 non-Moamalat
gateways, since none were configured in the DPay dashboard's Pay Methods
settings at test time (`edfali` failed with "gateway is not configured" —
an account setup step in DPay's own dashboard, not a code issue). Moamalat
needed no such setup and was the one gateway tested fully live.

The subscription-payment path (see above) was live-verified the same way:
`POST /api/payments/dpay-checkout` with `tier: "professional"`,
`dpayPayMethod: "moamalat"` → real session opened, correct `Payment` row
(`method: "dpay"`, `amount: 280`); a self-signed `payment.paid` webhook
with `data: { payment_id }` → `Payment.status` flips to `approved` and the
merchant's `subscriptionTier`/`subscriptionStatus`/`subscriptionEndDate`
update exactly as `/api/admin/payments/[id]/approve` already does; a
duplicate delivery of the same event → safe no-op, no double-activation.

## Setup checklist before this can go live

1. Configure each gateway you want to accept in DPay's dashboard → Pay
   Methods (mobile+PIN for Edfali, provider/PIN for the bank cards, etc.)
   — `moamalat` needed no such setup and worked immediately.
2. Add a webhook endpoint in DPay's dashboard → Webhooks pointing at
   `https://<your-domain>/api/dpay/webhook`, mode `live` (or `both` while
   testing), subscribed to at least `payment.paid`, `payment.failed`,
   `payment.expired`.
3. Set `DPAY_API_TOKEN` and `DPAY_WEBHOOK_SECRET` in Vercel's env vars —
   the same values used locally were pasted in chat, so rotate them from
   the DPay dashboard once this is confirmed working end-to-end.
4. Run the Prisma migration this integration adds
   (`add_dpay_wallet_fields`) against production.
