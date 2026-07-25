# Marsa Backend — Next.js + Prisma migration

This is the original `marsa-backend` (Express + better-sqlite3) migrated to
**Next.js 15 App Router API routes + Prisma + PostgreSQL**. Same data model,
same business logic, same endpoints — just a different framework and
database underneath. This is a backend-only migration; the Rifqa
storefront/dashboard UI is a separate, later task.

## What changed vs. the original

| Original (Express) | Migrated (Next.js) |
|---|---|
| `better-sqlite3` file DB | PostgreSQL via Prisma |
| `src/routes/*.js` | `src/app/api/**/route.ts` |
| `requireMerchant` middleware | `getAuthMerchantId(req)` helper called per-route (App Router has no middleware chaining on route handlers) |
| Raw SQL strings | Prisma Client queries |
| `nanoid` primary keys | Prisma `cuid()` primary keys |
| No input validation | Zod schemas in `src/lib/validation.ts` |

**Nothing changed** about: the courier dispatch flow, the wallet/COD payment
logic, server-side price recalculation at checkout, or the mock-until-you-
have-real-credentials pattern for Vanex / Dareeb Sabil / Shaheen / DPay.

## Setup

1. Install Node.js 18+.
2. `npm install`
3. `cp .env.example .env` and set `DATABASE_URL` to a real Postgres instance
   (local, Supabase, Neon, Railway — any will do). Leave the courier/payment
   keys blank for now; everything works with realistic mocks until you have
   real accounts with Vanex, DPay, etc.
4. `npm run prisma:migrate` — creates the Postgres tables from
   `prisma/schema.prisma`.
5. `npm run seed` — creates one test merchant, one test store, and 4
   products. Login: phone `0910000000`, password `password123`.
6. `npm run dev` — server runs at http://localhost:3000

## Core endpoints (same shapes as the original)

| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register | Create a merchant account |
| POST | /api/auth/login | Log in, get a JWT |
| POST | /api/stores | Create a store (needs auth) |
| GET | /api/stores/mine | List your own stores (needs auth) |
| GET | /api/stores/public/:slug | Public storefront data (no auth) |
| POST | /api/products | Add a product to your store (needs auth) |
| GET | /api/products/by-store/:storeId | List a store's products (needs auth) |
| DELETE | /api/products/:id | Soft-delete a product (needs auth) |
| POST | /api/orders | A buyer places an order (no auth — checkout) |
| GET | /api/orders/by-store/:storeId | Merchant views their orders (needs auth) |
| GET | /api/health | Health check |

Auth works the same way: send `Authorization: Bearer <token>` on any
route marked "needs auth".

## What's real right now vs. what's mocked

**Real:** merchant accounts, store creation, product management, order
creation, price calculation (done server-side so a buyer can't fake a
cheaper price), Postgres persistence via Prisma, Zod-validated inputs.

**Mocked (clearly marked with TODOs in the code):** actual calls to Vanex,
Dareeb Sabil, Shaheen, and DPay. Each one returns a realistic fake response
so you can build and test the full order flow today. Swapping in a real
courier or DPay call later is a small, contained change — not a rewrite —
because everything funnels through `src/lib/integrations/couriers.ts` and
`src/lib/integrations/payments.ts`.

## Frontend (added)

The UI is now built on top of the API above, in the same Next.js app:

| Page | Route | Notes |
|---|---|---|
| Marketing landing | `/` | Hero, courier/payment partner strip, feature grid, pricing (150/280/450 د.ل) |
| Register / Login | `/register`, `/login` | Stores JWT in `localStorage` via `AuthProvider` |
| Store wizard | `/onboarding` | 2 steps: name → courier + payment settings, calls `POST /api/stores` |
| Storefront | `/store/[slug]` | Public catalog, search, slide-over cart (`useCart` hook, localStorage per store) |
| Checkout | `/store/[slug]/checkout` | Buyer details, courier (fixed by store), COD/wallet choice |
| Confirmation | `/store/[slug]/confirmation` | Order ID, tracking code, total — passed via query params from the checkout response (there's no public single-order lookup endpoint, by design — orders are only queryable by an authenticated merchant) |
| Dashboard | `/dashboard`, `/dashboard/products`, `/dashboard/orders` | Sidebar + store switcher, revenue/order stats, product CRUD, order table with status filter |

Design identity: "Marsa" (مرسى, harbor) — navy/canvas/brass palette, Cairo +
Tajawal type, a circular "port stamp" badge as the recurring signature
element (popular pricing tier, order status chips). Tokens live in
`tailwind.config.ts`.

**Known simplification:** the original doc describes a manual "Dispatch
Order" button in the dashboard. The migrated backend (like the original)
assigns the courier automatically at checkout (`POST /api/orders`), so
there's no separate dispatch step or endpoint — the dashboard reflects that
by just showing the tracking code and status that's already there. If you
want manual dispatch instead, that needs a new `PATCH /api/orders/:id`
route plus a status state machine, which isn't in either version yet.

## Next real steps, in order

1. Run `npm install`, `npm run prisma:migrate`, `npm run seed`, `npm run dev`,
   then click through the flow end to end: register → onboarding → add a
   product → visit `/store/<your-slug>` → checkout → dashboard.
2. Swap in a real logo/imagery for the storefront product grid (currently
   shows a placeholder when `imageUrl` is empty).
3. Deploy this somewhere real (Vercel is the natural fit for Next.js;
   pair it with a managed Postgres like Neon or Supabase).
4. Only once you have an actual Vanex/DPay account: fill in the `.env` keys
   and replace the `TODO` blocks in `src/lib/integrations/` with real HTTP
   calls — the surrounding order logic doesn't need to change at all.
