# Subdomains + custom domains

Every store gets `{slug}.rifqa.ly` automatically — no setup, since the
subdomain literally *is* the store's existing `slug`. Merchants can
additionally point their own domain (e.g. `shop.their-brand.ly`) at their
store.

## Why this needed `middleware.ts`

This is the one deliberate exception to this codebase's established
no-middleware convention (every auth/authz check elsewhere lives
per-route via `getAuthMerchantId`, see `src/lib/auth.ts`). Host-header
routing genuinely cannot be done any other way in Next.js — by the time a
request reaches a page or API route, there's no mechanism to change which
route handles it based on the `Host` header. That decision has to happen
in middleware, before the App Router sees the request at all.

`src/middleware.ts` rewrites two kinds of traffic to `/store/{slug}`:
- `{slug}.rifqa.ly` — pure string parsing, no DB lookup needed.
- a merchant's **verified** custom domain — needs a DB lookup.

Everything else (`rifqa.ly` itself, the `*.vercel.app` deploy URL,
`localhost`, and critically every `/api/*` and `/_next/*` request even
when the Host header is a store subdomain, excluded via `config.matcher`)
passes through untouched — the storefront's own client-side `fetch()`
calls to `/api/*` depend on this never being rewritten.

## Why custom-domain resolution isn't a direct DB call in middleware

Tried first, didn't work: Next.js middleware runs on the Edge runtime,
which can't execute Prisma's engine. Next.js 15.2+ was expected to offer
a stable `experimental.nodeMiddleware` opt-in for exactly this — tried it
here, and the build rejected it outright (*"Unrecognized key(s) in
object: 'nodeMiddleware' at experimental"*), meaning it isn't actually
available in this project's Next.js version (15.5.21) despite what looked
like documentation for it. So instead, middleware calls an ordinary
Node-runtime API route, `/api/internal/resolve-domain`, which does the
real Prisma lookup on middleware's behalf — one extra same-origin HTTP
hop, only for custom-domain traffic (subdomain traffic never needs it),
with a 60-second best-effort in-memory cache per Edge instance to avoid
hitting it on every request. Worth revisiting if a future Next.js
version actually ships working Node.js middleware.

## How custom domain verification actually works

This does **not** invent its own DNS-TXT-record verification scheme —
it defers entirely to Vercel's own Domains API
(`src/lib/domains/vercel-client.ts`), a public, stable, documented Vercel
API (unlike Vanex/DPay, nothing here was guessed or reverse-engineered):

1. Merchant enters a domain in dashboard → إعدادات المتجر → النطاق
   (`src/components/store/DomainSettings.tsx`).
2. `POST /api/merchant/domain` calls Vercel's `POST /v10/projects/{id}/domains`
   to actually register the domain with this Vercel project — this step
   is what makes Vercel terminate TLS and route traffic for that hostname
   here at all; without it, DNS could point at Vercel's edge all day and
   still get a "domain not configured" error.
3. Vercel responds either already-verified (some domains auto-verify) or
   with the DNS record(s) the merchant needs to add — surfaced directly
   in the settings UI.
4. `customDomainVerified` is only ever set from what Vercel itself
   confirms (`checkDomainVerification`, called both on-demand via a
   "تحقق الآن" button and lazily every time `GET /api/merchant/domain`
   loads) — application code never marks a domain verified on its own.
5. Once verified, `src/middleware.ts` routes it like any subdomain.

**Mock fallback** (`VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` unset): the
domain still saves to the DB, `addDomainToProject`/`checkDomainVerification`
return "not verified" with a manual-setup message instead of calling
Vercel, and the merchant sees "contact support to finish linking this
domain." Same graceful-degradation pattern as every other integration in
this codebase (Vanex, DPay, SendGrid, Resala) — nothing crashes without
real credentials, it just can't do the real thing yet.

## Setup required before this is live

1. **One-time, in Vercel's dashboard**: add `*.rifqa.ly` as a wildcard
   domain on this project (Project → Settings → Domains). This is what
   makes `{slug}.rifqa.ly` resolve for *any* slug without touching Vercel
   again per new store.
2. **One-time, at your DNS provider for rifqa.ly**: a wildcard record —
   typically `*.rifqa.ly CNAME cname.vercel-dns.com` (Vercel's domain
   setup screen gives the exact record once you add the wildcard domain
   in step 1).
3. **For real (non-mock) custom domain support**: generate a Vercel API
   token (vercel.com/account/tokens) with access to this project, and set
   `VERCEL_API_TOKEN` + `VERCEL_PROJECT_ID` (+ `VERCEL_TEAM_ID` if this
   project lives under a team, not a personal account) in both `.env`
   and Vercel's own project env vars.

## Data model

`Store.customDomain` (`@unique` — the actual guard against two merchants
claiming the same domain) and `Store.customDomainVerified`. No dedicated
verification-token field — verification state is Vercel's, not ours to
invent.

## Live-verified (once the DB was reachable)

- Real HTTP requests with a spoofed `Host` header (via `curl -H`, not
  Node's `fetch()` — the Fetch API spec forbids overriding `Host`
  through its `headers` option, which silently made an earlier version
  of this test meaningless before switching to `curl`):
  - `rifqa.ly` → not rewritten (landing page, not a store).
  - `{slug}.rifqa.ly` → rewritten, real store content served.
  - an unverified custom domain → correctly **not** rewritten (no
    accidental domain hijacking).
  - a verified custom domain → rewritten via the real
    `/api/internal/resolve-domain` lookup.
  - `/api/health` on a store subdomain Host header → untouched, still
    the API response, not rewritten to `/store/{slug}/api/health`.
- `/api/merchant/domain` end to end in mock mode: set → shows unverified
  with a manual-setup message; a second merchant trying the same domain
  → `409`; a merchant touching another's store → `403`; an invalid
  domain string → `400`; removal → clears cleanly.

## Known limitations

- No real custom domain has been verified against the live Vercel API —
  `VERCEL_API_TOKEN` wasn't available while building this, so only the
  mock path was exercised. The Domains API calls follow Vercel's public
  documentation but haven't been proven against a real account.
- A merchant with multiple stores manages each store's domain
  independently (per `storeId`) — there's no "primary domain for my
  account" concept, matching how every other per-store setting in this
  app already works.
- `removeDomainFromProject` is best-effort — if it fails against Vercel's
  API, the local DB row is still cleared. The domain would stay attached
  to this Vercel project until removed manually; a very old customDomain
  string that's since been reused for another project isn't reconciled.
