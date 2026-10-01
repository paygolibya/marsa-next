import { NextResponse } from "next/server";
import { domainToUnicode } from "node:url";

// Same constant as middleware.ts (kept duplicated rather than shared —
// middleware.ts runs on the Edge runtime and this route runs on Node;
// a one-line env lookup isn't worth a cross-runtime shared module).
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

export type ResolveDomainDb = {
  store: {
    findFirst: (args: { where: { customDomain: string; customDomainVerified: true }; select: { slug: true } }) => Promise<{ slug: string } | null>;
    findUnique: (args: { where: { slug: string }; select: { slug: true } }) => Promise<{ slug: string } | null>;
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
export async function handleResolveDomain(db: ResolveDomainDb, req: Request): Promise<Response> {
  const host = new URL(req.url).searchParams.get("host");
  if (!host) return NextResponse.json({ slug: null });
  const lower = host.toLowerCase();

  if (lower.endsWith(`.${ROOT_DOMAIN}`)) {
    const label = lower.slice(0, -(ROOT_DOMAIN.length + 1));
    if (!label.startsWith("xn--")) return NextResponse.json({ slug: null });
    const decodedSlug = domainToUnicode(label);
    const store = await db.store.findUnique({ where: { slug: decodedSlug }, select: { slug: true } });
    return NextResponse.json({ slug: store?.slug ?? null });
  }

  const store = await db.store.findFirst({
    where: { customDomain: lower, customDomainVerified: true },
    select: { slug: true },
  });
  return NextResponse.json({ slug: store?.slug ?? null });
}
