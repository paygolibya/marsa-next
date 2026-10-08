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
// (or a newly-configured redirect) takes a little longer to show up here;
// customDomainVerified itself is only ever set by a real Vercel
// verification check, never by this cache. Keyed by hostname+pathname
// (not hostname alone) now that the same round trip also carries a
// path-specific redirect lookup — see resolveViaApi below.
const domainCache = new Map<string, { slug: string | null; redirectTo: string | null; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

// Resolves BOTH the store slug (for punycode-subdomain/custom-domain
// hosts, which need a DB lookup Edge can't do directly) and, in the same
// round trip, whether a Redirect is configured for this exact path —
// avoiding a second round trip for stores that reach this function at
// all. The ASCII-subdomain fast path below still resolves its own slug
// locally with zero round trips either way; it only calls this for the
// redirect-checking side, deliberately ignoring the slug this returns (to
// never regress that path's existing zero-DB-call behavior).
async function resolveViaApi(req: NextRequest, hostname: string, pathname: string): Promise<{ slug: string | null; redirectTo: string | null }> {
  const cacheKey = `${hostname}${pathname}`;
  const cached = domainCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  try {
    const res = await fetch(new URL(`/api/internal/resolve-domain?host=${encodeURIComponent(hostname)}&path=${encodeURIComponent(pathname)}`, req.url));
    const value = (await res.json()) as { slug: string | null; redirectTo: string | null };
    domainCache.set(cacheKey, { ...value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    // Resolver route unreachable — fail open to "unrecognized host, no
    // redirect" rather than block the request indefinitely.
    return { slug: null, redirectTo: null };
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
  // Set only when resolveViaApi already ran (punycode subdomain or custom
  // domain) — the response already carries the redirect check for free in
  // that case. The ASCII-subdomain fast path leaves this null and checks
  // separately below, since it never calls the API for its slug.
  let redirectTo: string | null = null;
  let checkedRedirect = false;

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
    if (label.startsWith("xn--")) {
      const resolved = await resolveViaApi(req, hostname, req.nextUrl.pathname);
      slug = resolved.slug;
      redirectTo = resolved.redirectTo;
      checkedRedirect = true;
    } else {
      slug = label;
    }
  } else {
    const resolved = await resolveViaApi(req, hostname, req.nextUrl.pathname);
    slug = resolved.slug;
    redirectTo = resolved.redirectTo;
    checkedRedirect = true;
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

  // The ASCII-subdomain fast path never called the API above (zero DB
  // calls, by design, to never regress that path's existing behavior) —
  // a redirect for it still needs exactly one lookup, the real cost of
  // adding redirect support without touching that path's slug resolution.
  if (!checkedRedirect) {
    redirectTo = (await resolveViaApi(req, hostname, req.nextUrl.pathname)).redirectTo;
  }

  if (redirectTo) {
    const url = req.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url, 308);
  }

  const url = req.nextUrl.clone();
  url.pathname = `/store/${slug}${req.nextUrl.pathname === "/" ? "" : req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // The `.*\..*` branch excludes any path with a file extension (logo.png,
  // payment-logos/moamalat.png, icon-192.png, ...) — these are real files
  // under public/, never storefront routes, but without this the subdomain
  // rewrite below ran on them too and turned `{slug}.rifqa.ly/logo.png`
  // into a rewrite to `/store/{slug}/logo.png` (not a real route) — a
  // real, confirmed-live 404 that broke every <Image> using a public
  // asset on any storefront page (next/image's own image-optimization
  // pipeline fetches the source over HTTP, so it hit this rewrite too,
  // surfacing as a 400 in the browser instead of the 404 itself).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
