import { NextResponse } from "next/server";
import { domainToUnicode } from "node:url";

// Same constant as middleware.ts (kept duplicated rather than shared —
// middleware.ts runs on the Edge runtime and this route runs on Node;
// a one-line env lookup isn't worth a cross-runtime shared module).
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

export type ResolveDomainDb = {
  store: {
    findFirst: (args: { where: { customDomain: string; customDomainVerified: true }; select: { id: true; slug: true } }) => Promise<{ id: string; slug: string } | null>;
    findUnique: (args: { where: { slug: string }; select: { id: true; slug: true } }) => Promise<{ id: string; slug: string } | null>;
  };
  redirect: {
    findUnique: (args: { where: { storeId_fromPath: { storeId: string; fromPath: string } } }) => Promise<{ toPath: string } | null>;
  };
};

// GET /api/internal/resolve-domain?host=... — looks up which store a
// host belongs to, for two cases middleware.ts can't resolve on its own
// (it runs on the Edge runtime and so can't run Prisma's engine
// directly):
//
// 1. A verified custom domain — the original reason this route exists.
// 2. A {slug}.rifqa.ly subdomain whose slug contains non-ASCII
//    characters (store slugs intentionally allow Arabic — see
//    lib/slug.ts). Browsers always send such a Host header IDN/punycode-
//    encoded (confirmed: a browser given https://متجر.rifqa.ly actually
//    requests xn--mgbccv2b5f0a.rifqa.ly) — the middleware's fast path
//    for ASCII subdomains (string-slicing the slug straight out of the
//    Host header, no DB hit) would slice out that punycode label and
//    compare it against the real, Unicode slug stored in the DB, which
//    can never match. Confirmed live: a freshly onboarded store with an
//    Arabic name's subdomain never resolved at all. Decoding the label
//    back to Unicode here (Node's domainToUnicode isn't available on
//    the Edge runtime, which is why this round-trips through here at
//    all) and looking it up directly fixes it.
//
// With an optional `path` param, also resolves the ASCII-subdomain case
// (which middleware.ts otherwise never sends here) purely to check for a
// configured Redirect on that exact path — see middleware.ts's
// resolveViaApi for the full reasoning.
export async function handleResolveDomain(db: ResolveDomainDb, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const host = url.searchParams.get("host");
  // Optional — when given, also checks whether a Redirect is configured
  // for this exact path, in the same round trip as the slug resolution
  // below (see middleware.ts's resolveViaApi for why this matters: it's
  // the one DB round trip those callers already pay for anyway).
  const path = url.searchParams.get("path");
  if (!host) return NextResponse.json({ slug: null, redirectTo: null });
  const lower = host.toLowerCase();

  let store: { id: string; slug: string } | null = null;

  if (lower.endsWith(`.${ROOT_DOMAIN}`)) {
    const label = lower.slice(0, -(ROOT_DOMAIN.length + 1));
    // An ASCII label IS the slug already — middleware's fast path never
    // calls this endpoint for ITS OWN slug resolution in that case (zero
    // DB calls, by design), but it still calls here with `path` set to
    // check for a redirect, which needs the store's real id. A punycode
    // label needs decoding first (not available on the Edge runtime
    // middleware itself runs on — see middleware.ts).
    const resolvedSlug = label.startsWith("xn--") ? domainToUnicode(label) : label;
    store = await db.store.findUnique({ where: { slug: resolvedSlug }, select: { id: true, slug: true } });
  } else {
    store = await db.store.findFirst({
      where: { customDomain: lower, customDomainVerified: true },
      select: { id: true, slug: true },
    });
  }

  if (!store) return NextResponse.json({ slug: null, redirectTo: null });

  let redirectTo: string | null = null;
  if (path) {
    const redirect = await db.redirect.findUnique({ where: { storeId_fromPath: { storeId: store.id, fromPath: path } } });
    redirectTo = redirect?.toPath ?? null;
  }

  return NextResponse.json({ slug: store.slug, redirectTo });
}
