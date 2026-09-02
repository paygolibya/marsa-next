# Free trial + subscription auto-expiry

## What changed

Previously, every new signup started `subscriptionStatus: "pending"` and
sat there — no dashboard access, no store, nothing — until an admin
manually reviewed a payment receipt and approved them. New signups now
get **immediate, full access for 90 days**, no payment or admin review
required: `subscriptionStatus: "active"`, `subscriptionTier: "advanced"`
(full feature set, so they can actually evaluate the platform — wallet
payments, API access, everything), `subscriptionEndDate` and
`trialEndsAt` both set to 90 days out. See `src/app/api/auth/register/route.ts`.

This only affects **new** registrations. Existing merchants already in
`pending`/`inactive`/`rejected`/`suspended` states are untouched — the
admin's manual accept/reject/suspend routes (`/api/admin/merchants/*`)
still work exactly as before, for whatever pre-trial signups are still
sitting in those states.

## Why `trialEndsAt` is a separate field from `subscriptionEndDate`

`subscriptionEndDate` is the one field that actually gates access (see
below) — it's set by a trial, and later overwritten by a real payment
approval (`/api/admin/payments/[id]/approve` or `/api/admin/merchants/accept`,
both of which push it 30 days out from approval time). `trialEndsAt` is
never touched again after registration — it's kept purely so the UI/admin
can tell "still on the original free trial" apart from "already converted
to a real paid period," by checking whether the two still match
(`subscriptionEndDate === trialEndsAt`). Once a merchant pays for real,
they stop matching and every "trial" badge/banner disappears on its own —
no extra bookkeeping needed for that transition.

## Auto-expiry — a gap that existed before this, not introduced by it

Worth being explicit about: **`subscriptionEndDate` was never actually
enforced anywhere in this codebase before now.** The accept/approve
routes set it 30 days out, but nothing ever checked whether that date had
passed — a merchant who paid once for a month stayed `active` forever.
Adding a 90-day trial made this gap impossible to ignore (a trial that
never ends isn't a trial), so this also builds the first real enforcement
of it, for trial and paid periods alike:

- **Lazy, on-demand** (`src/lib/subscription/expire.ts`'s `expireIfLapsed`) —
  called from `/api/auth/login` and `/api/auth/me`, so a merchant sees
  the real, current state the moment they log in or their dashboard
  refreshes, not up to a day later.
- **Daily cron backstop** (`/api/cron/expire-subscriptions`, 3am UTC,
  `expireAllLapsed`) — same GET-for-Vercel-Cron/POST-for-manual-admin
  pattern as the payout crons, logging to the same `CronLog` table, so
  the admin's merchant list reflects reality even for someone who hasn't
  logged back in. Reuses `withRetry`/`logCronRun` from
  `src/lib/payment/payout-processor.ts` rather than duplicating them.

Both call the same `where: { subscriptionStatus: "active",
subscriptionEndDate: { lt: now } }` → `inactive` update — an atomic
`updateMany`, so the lazy path and the cron can never double-process the
same merchant into some inconsistent state.

Once flipped to `inactive`, a merchant sees the existing gate screen in
`dashboard/layout.tsx` — its `inactive` copy ("أكمل الاشتراك ورفع إيصال
الدفع...") already fit this case perfectly with no changes, and now also
gets a direct "اشترك الآن" link to `/subscription`.

## What the merchant/admin actually see

- **Merchant dashboard**: a banner while `subscriptionEndDate ===
  trialEndsAt` ("أنت في الفترة التجريبية المجانية — تنتهي خلال N يوم"),
  linking to `/subscription`.
- **Admin merchants list**: a "تجريبي — N يوم متبقي" badge next to the
  status pill, same matching logic.

## Known limitations

- **Vercel Cron plan limit**: this adds a *third* cron job
  (`vercel.json`). Vercel's Hobby plan allows only a small number of cron
  jobs (historically 2) — if this project is on Hobby, deploying this may
  fail or silently drop a cron. Worth checking the Vercel dashboard after
  deploying; if it's a problem, `expire-subscriptions` is the easiest of
  the three to fold into a less-frequent schedule or merge into
  `process-deliveries`'s daily run, since it's cheap and unrelated to
  payouts.
- The 90-day trial tier is hardcoded to `"advanced"` (`TRIAL_TIER` in
  `register/route.ts`) — not configurable per merchant or via env var.
- No warning email/SMS is sent as a trial approaches expiry — the
  merchant only finds out via the dashboard banner (so only if they log
  in) or by hitting the gate once it's actually over.
