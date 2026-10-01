import { NextRequest, NextResponse } from "next/server";

/**
 * The one deliberate exception to this codebase's no-middleware
 * convention (every other auth/authz check lives per-route via
 * getAuthMerchantId — see src/lib/auth.ts). Host-header-based routing is
 * the one thing that genuinely can't be done any other way in Next.js:
 * by the time a request reaches a page or API route, there's no way to
 * change which route handles it based on the Host header — that decision
 * has to happen here, before the App Router sees it.
 *
 * Two things this resolves to a store, both rewritten to /store/{slug}:
 *  - {slug}.rifqa.ly — pure string parsing, no DB needed (the subdomain
 *    IS the slug).
 *  - a merchant's verified custom domain — needs a DB lookup, but
 *    middleware runs on the Edge runtime here (Next.js 15.5's
 *    `experimental.nodeMiddleware` flag doesn't actually exist in this
 *    version yet — confirmed by a hard "unrecognized key" build warning
 *    when tried), and Edge can't run Prisma's engine at all. So instead
 *    of querying the DB directly, this calls an ordinary Node-runtime API
 *    route (/api/internal/resolve-domain) that does the real lookup.
 *
 * Everything else (rifqa.ly itself, the *.vercel.app deploy URL,
 * localhost, and — importantly — every /api/* and /_next/* request, even
 * on a store subdomain, matched out via `config.matcher` below) passes
 * through untouched — except rifqa.ly's own /store/{slug}/... path, which
 * redirects to the equivalent {slug}.rifqa.ly URL rather than serving the
 * storefront directly. Storefronts are meant to be reachable on exactly
 * one URL (their subdomain, or a verified custom domain); without this,
 * the same storefront was also directly reachable at the apex domain's
 * /store/{slug} path — which is also the internal page route the
 * subdomain rewrite below targets, so it can't simply be removed.
 */
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

// Best-effort, per-Edge-instance cache — an Edge runtime has no shared
// memory across instances/regions, so this only ever saves *some*
// round trips, never all of them. A stale hit just means a domain change
// takes a little longer to show up here; customDomainVerified itself is
// only ever set by a real Vercel verification check, never by this cache.
const domainCache = new Map<string, { slug: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

async function resolveCustomDomainSlug(req: NextRequest, hostname: string): Promise<string | null> {
  const cached = domainCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.slug;

  try {
    const res = await fetch(new URL(`/api/internal/resolve-domain?host=${encodeURIComponent(hostname)}`, req.url));
    const { slug } = (await res.json()) as { slug: string | null };
    domainCache.set(hostname, { slug, expiresAt: Date.now() + CACHE_TTL_MS });
    return slug;
  } catch {
    // Resolver route unreachable — fail open to "unrecognized host" rather
    // than block the request indefinitely.
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const hostname = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();

  if (!hostname || hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    // Storefronts only ever work on their own subdomain now — the apex
    // domain used to also directly serve /store/{slug} (that's the page
    // route the subdomain rewrite below targets internally), so the exact
    // same storefront was reachable at two different URLs. A few places
    // in the app (an old admin "view store" link) still generated that
    // apex form; this redirect is the backstop that holds regardless of
    // where such a link comes from — a bookmark, something shared before
    // this change, a dev mistake later.
    if (req.nextUrl.pathname.startsWith("/store/")) {
      const afterPrefix = req.nextUrl.pathname.slice("/store/".length);
      const [slug, ...rest] = afterPrefix.split("/");
      if (slug) {
        const url = req.nextUrl.clone();
        url.hostname = `${slug}.${ROOT_DOMAIN}`;
        url.pathname = rest.length > 0 ? `/${rest.join("/")}` : "/";
        return NextResponse.redirect(url, 308);
      }
    }
    return NextResponse.next();
  }

  if (hostname.endsWith(".vercel.app") || hostname === "localhost") {
    return NextResponse.next();
  }

  let slug: string | null = null;
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const label = hostname.slice(0, -(ROOT_DOMAIN.length + 1));
    // xn-- — a punycode-encoded label, meaning the real slug has
    // non-ASCII characters (store slugs intentionally allow Arabic —
    // lib/slug.ts). The browser sends this Host header IDN-encoded, not
    // as the original Unicode text, so the slug can't just be sliced out
    // here — decoding punycode needs Node's `url` module, not available
    // on this Edge runtime, hence the same resolver round-trip the
    // custom-domain case below already needs for its own reason (a DB
    // lookup Edge can't do directly). Confirmed live: without this, no
    // Arabic-named store's subdomain ever resolved.
    slug = label.startsWith("xn--") ? await resolveCustomDomainSlug(req, hostname) : label;
  } else {
    slug = await resolveCustomDomainSlug(req, hostname);
  }

  if (!slug) {
    // Unrecognized host — not the main domain, not a known subdomain, not
    // a verified custom domain. Let it fall through to whatever Next.js
    // would otherwise do (effectively a 404), rather than guess.
    return NextResponse.next();
  }

  // The storefront's own internal links (product pages, checkout, ...)
  // are written as absolute /store/{slug}/... paths — correct on the main
  // domain (rifqa.ly/store/{slug}/product/x), but on a subdomain the
  // browser is already at {slug}.rifqa.ly, so clicking one of those links
  // arrives here with pathname already equal to /store/{slug}/product/x.
  // Blindly prepending /store/{slug} again produced
  // /store/{slug}/store/{slug}/product/x — a real 404, confirmed live on
  // every existing store's product/checkout links. If the path already
  // targets a real /store/... route, leave it alone.
  if (req.nextUrl.pathname.startsWith("/store/")) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = `/store/${slug}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
