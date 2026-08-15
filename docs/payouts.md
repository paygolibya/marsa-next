# Merchant payout system

Centralized commission/payout tracking for Rifqa. Plutu/DPay wallet payments
land in one Rifqa account; this system calculates what each merchant is owed
(97%) and what Rifqa keeps (3%), and lets an admin record when a transfer
has actually gone out. No automatic bank transfers happen anywhere — every
payout is calculated here, then paid manually outside the app, then marked
as paid here for the record.

## Why only wallet orders are eligible

Cash-on-delivery orders are collected by the courier directly from the
buyer and never touch Rifqa's account — `Order.paymentStatus` for a COD
order never becomes `"paid"` anywhere in this codebase (confirmed by
reading `src/app/api/orders/route.ts`: only the wallet/DPay path sets it).
Calculating a "payout" for a COD order would mean instructing an admin to
send a merchant money Rifqa never actually received. So the eligibility
filter (`src/lib/payment/commission.ts`) is:

```
Order.status === "delivered"
  AND Order.paymentMethod === "wallet"
  AND Order.paymentStatus === "paid"
```

If your actual settlement flow is different (e.g. couriers remit COD cash
to Rifqa before Rifqa forwards it to merchants), this filter needs to
change — it was inferred from how payments are actually implemented today,
not stated explicitly in the original request.

## Data model

- **`Commission`** — one row per eligible order (`orderId` is `@unique`,
  which is the actual guard against double-paying the same order, even
  under a race between two concurrent calculation runs). Records the
  order's total, Rifqa's cut, and the merchant's cut at the moment it was
  calculated — historical commission-rate changes never retroactively
  change past commissions.
- **`Payout`** — one row per merchant per calculation run, aggregating that
  run's `Commission` rows for that merchant. Status is `pending` →
  (optionally `processing`, tracked but no route flips it automatically) →
  `completed`.

All money fields are `Int` cents, matching every other money field in this
schema (`Order.totalCents`, etc.) — not `Decimal`.

## API

- `POST /api/admin/calculate-payouts` — body `{ periodStart?, periodEnd? }`
  (ISO datetimes, defaults to the last 7 days). Finds eligible orders in
  range, groups by merchant, creates one `Payout` + one `Commission` per
  order inside a single transaction. If any order was already claimed by a
  concurrent run, the whole transaction rolls back and returns 409 — safe,
  but means re-running immediately after a 409 is expected behavior, not a
  bug (the second run will simply see fewer/no eligible orders).
- `GET /api/admin/payouts?status=pending` — list payouts + platform-wide
  stats (total sales, total commission, pending payout total).
- `POST /api/admin/payouts/:id/mark-paid` — body `{ note? }`. Rejects (409)
  if the payout is already `completed`, preventing a duplicate transfer
  from being logged against the same money.
- `GET /api/merchant/payouts` — the authenticated merchant's own pending
  total, last completed payout, and full history. No admin required,
  always scoped to the caller.

## UI

- `/admin/payouts` — stats tiles, a date-range "احتساب الدفعات" (calculate)
  action, a filterable payout list, "تحديد كمدفوع" (mark paid) per row, and
  a CSV export of whatever's currently filtered/loaded.
- `/dashboard/payouts` (renders `src/components/merchant/PayoutDashboard.tsx`)
  — pending amount, last payout, commission rate, full history table.

## Running a payout cycle

1. Admin opens `/admin/payouts`, optionally sets a date range (defaults to
   the last 7 days), clicks "احتساب الدفعات".
2. Review the resulting payout list — one row per merchant with orders in
   that range.
3. Send each merchant their money manually (bank transfer, etc.).
4. Click "تحديد كمدفوع" per payout once sent. This is a manual, deliberate
   action — nothing here moves money on its own.

## Known limitations / things to revisit

- `processing` is a valid `Payout.status` value in the schema but nothing
  currently sets it — only `pending` (on creation) and `completed` (via
  mark-paid) are reachable today. Add a route for it if you want an
  explicit "transfer initiated, not yet confirmed" step.
- A duplicate-claim race during `calculate-payouts` rolls back the *entire*
  run (all merchants in that batch), not just the affected merchant. This
  favors correctness over availability — re-running the calculation
  immediately after is the intended recovery, not a special error path to
  build UI around.
- Commission calculation groups by `Order.courierStatusAt` (when the order
  was marked delivered), not `Order.createdAt` (when it was placed) — this
  assumes every `status: "delivered"` order also has a non-null
  `courierStatusAt`, which is true today because the Vanex webhook is the
  only code path that sets `status: "delivered"`, always alongside
  `courierStatusAt` in the same update. If a future code path sets
  `status: "delivered"` without setting `courierStatusAt`, that order would
  silently never become eligible for any period range.
