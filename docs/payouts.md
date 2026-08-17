# Automatic merchant payout system

Centralized, automatic commission/payout tracking for Rifqa. Plutu/DPay
wallet payments land in one Rifqa account; this system calculates what
each merchant is owed (99%) and what Rifqa keeps (1%) automatically, with
**zero admin clicks for calculation**. The only manual step in the whole
system is the admin confirming a transfer was actually sent.

## Why only wallet orders are eligible

Cash-on-delivery orders are collected by the courier directly from the
buyer and never touch Rifqa's account — `Order.paymentStatus` for a COD
order never becomes `"paid"` anywhere in this codebase (confirmed by
reading `src/app/api/orders/route.ts`: only the wallet/DPay path sets it).
Calculating a payout for a COD order would mean instructing an admin to
send a merchant money Rifqa never actually received. So the eligibility
check (`src/lib/payment/commission.ts`) is:

```
Order.status === "delivered"
  AND Order.paymentMethod === "wallet"
  AND Order.paymentStatus === "paid"
```

## How the automation actually works

Three triggers feed the same underlying logic
(`src/lib/payment/payout-processor.ts`):

1. **Real time** — the instant the Vanex webhook
   (`src/app/api/vanex/webhook/route.ts`) marks an order `delivered`, it
   calls `calculateCommissionForOrder(orderId)` directly, best-effort (a
   failure here is logged but never fails the webhook response). This is
   what gets a commission calculated "within a minute" of delivery in
   practice.
2. **Daily cron, 8am UTC** (`/api/cron/process-deliveries`) — a catch-up
   pass over everything delivered in the last 24h that still has no
   Commission row. Exists for whatever the real-time trigger missed (a
   webhook retry that arrived before the DB write committed, an order
   marked delivered some other way in the future, etc.) — not the primary
   path, a backstop.
3. **Weekly cron, Friday 9am UTC** (`/api/cron/weekly-payouts`) — bundles
   every Commission not yet attached to a Payout (`payoutId: null`) into
   one Payout per merchant. This is the unit an admin actually transfers
   money against.

No admin ever clicks anything to make a Commission or Payout exist. The
**only** manual action anywhere in this system is
`POST /api/admin/payouts/transfer` after the admin has actually sent the
money.

### Why "real-time + daily backstop" instead of just the daily cron

The pasted spec's own acceptance criteria required commission within ~1
minute of delivery, which a once-a-day cron alone can't satisfy — so the
webhook calls the same calculation function directly, and the daily cron
exists purely as a safety net for whatever that best-effort call misses.
Both paths converge on the same function and the same uniqueness
guarantee, so there's no special-casing between "real-time" and
"cron-caught" commissions once they exist.

### Vercel Cron uses GET, not POST

Vercel's cron scheduler invokes the configured path with an HTTP `GET`
request (and an `Authorization: Bearer $CRON_SECRET` header, once
`CRON_SECRET` is set) — not `POST`, despite how some integration guides
describe it. Both cron routes export `GET` for that. They also export
`POST`, admin-authenticated, purely as a manual recovery path (e.g. via
curl) if a cron run needs to be re-triggered by hand — this is
intentionally not exposed anywhere in the UI, since calculation itself
has no manual step by design.

**Setup required**: set `CRON_SECRET` to the same random value in both
`.env` (for local testing) and the Vercel project's environment variables
(for production — Vercel injects it into the request automatically once
both the env var and the `crons` entry in `vercel.json` exist). Without
it set, the routes still work but log a warning and accept unauthenticated
requests — fine for local dev, not for production.

## Data model

- **`Commission`** — one row per eligible order (`orderId` is `@unique`,
  the actual guard against double-paying the same order, even under a
  race between the real-time trigger and the daily cron hitting the same
  order). `status`: `calculated` (default, on creation) → `paid` (once
  its Payout is transferred).
- **`Payout`** — one row per merchant per weekly batching run, aggregating
  that run's un-batched `Commission` rows for that merchant. `status`:
  `ready_for_transfer` (default, on creation by the Friday cron) →
  `transferred` (admin's manual action, recording who and when).
- **`CronLog`** — one row per cron execution (both the daily and weekly
  jobs), recording success/failure, counts, duration, and error text —
  the audit trail for "did the automation actually run."
- **`Order`** also gets denormalized `rifqaCommissionCents`,
  `merchantPayoutCents`, `payoutStatus`, `payoutCalculatedAt`,
  `payoutTransferredAt` — set the moment its Commission is created/paid,
  so the order itself is queryable without a join. These mirror, not
  replace, the `Commission` row, which remains the source of truth.

All money fields are `Int` cents, matching every other money field in
this schema (`Order.totalCents`, etc.) — not `Decimal`.

## API

- `GET /api/admin/payouts/ready?status=` — list payout batches (optionally
  filtered) + platform-wide stats. Nothing here is admin-triggered.
- `POST /api/admin/payouts/transfer` — body `{ payoutId, transferReference?, note? }`.
  **The only manual action in the system.** Rejects (409) a payout that's
  already `transferred`.
- `GET /api/admin/cron-logs` — last 100 cron executions, newest first.
- `GET /api/merchant/payouts` — the authenticated merchant's own pending
  total (every unpaid Commission, batched or not — always current, not
  just whatever the last weekly batch caught), last transferred payout,
  and full history.
- `GET/POST /api/cron/process-deliveries`, `GET/POST /api/cron/weekly-payouts`
  — see above.

## UI

- `/admin/payouts` — banner making clear calculation is automatic, stats
  tiles, a status-filterable payout list, and a "تحويل" (transfer) button
  per row — no calculate button anywhere.
- `/admin/cron-logs` — table of every automatic job run, for verifying the
  automation is actually firing without digging through Vercel's own logs.
- `/dashboard/payouts` (`src/components/merchant/PayoutDashboard.tsx`) —
  pending amount, last payout, 1% commission rate, full history, with a
  banner explaining payouts are calculated automatically.

## Error handling & retries

- `calculateCommissionForOrder` catches the Commission unique-constraint
  violation (Postgres `P2002`) and treats it as a no-op, not an error —
  this is what makes the real-time trigger and daily-cron backstop safe
  to race each other.
- Both cron routes wrap their core work in `withRetry` (3 attempts,
  exponential backoff: 1s, 2s, 4s) before giving up and logging a
  `failed` CronLog row.
- A per-order failure inside the daily cron's loop doesn't stop the batch
  — it's collected into `errors` and still surfaces in the CronLog's
  `errorMessage`, but orders that succeeded still get their Commission.
- A per-merchant failure inside the weekly batching loop is isolated the
  same way — one merchant's DB error doesn't block other merchants' Payouts
  from being created in the same run.

## Known limitations / things to revisit

- The weekly batch's `periodStart`/`periodEnd` is always "now minus 7
  days," not aligned to a Monday–Sunday calendar week or to the actual
  age of the Commission rows it bundles — if the weekly cron is ever
  skipped for two weeks, the next run's period label will still just say
  "last 7 days" even though it's bundling two weeks of Commissions. The
  amounts are always correct; only the period label can undersell how far
  back the bundle actually reaches.
- Real-time calculation depends on the Vanex webhook being the thing that
  sets `status: "delivered"` — if a future code path marks an order
  delivered some other way, it won't get the real-time trigger and will
  have to wait for the next daily cron run (up to ~24h) instead of ~1 min.
- Order-level `payoutStatus` etc. are denormalized copies of `Commission`
  data for query convenience — if either is ever updated in isolation
  (bypassing `payout-processor.ts`), they can drift out of sync. Only
  code in that file should ever write to them.

## What's genuinely still missing before launch

Everything above is live and verified against the real database. Sweeping
the rest of the codebase for the same "still a TODO" pattern found exactly
one: **`src/lib/integrations/payments.ts` (DPay/Plutu) always returns a
mock "paid" response — even with `DPAY_API_KEY` set**, unlike Vanex/
SendGrid/Resala, where setting the credential switches on a real call.
Nothing else in `src/` has an open TODO. Wiring DPay/Plutu for real needs
their actual API contract (endpoint, auth, request/response shape) — the
same kind of thing Vanex needed before it could be built for real, rather
than guessed at from a pasted guide.

Separately, unrelated to DPay: `JWT_SECRET` in `.env` is still the
placeholder `dev_secret_rifqa_marsaa`. If Vercel's production env var is
already a different, real secret, this is a non-issue — but if it's
inheriting this placeholder, it should be rotated before launch (note:
rotating it invalidates every merchant's current login session, so it's
a "pick a good moment" change, not a silent one).
