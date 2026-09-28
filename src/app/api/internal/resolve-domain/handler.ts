import { NextResponse } from "next/server";

export type ResolveDomainDb = {
  store: { findFirst: (args: { where: { customDomain: string; customDomainVerified: true }; select: { slug: true } }) => Promise<{ slug: string } | null> };
};

// GET /api/internal/resolve-domain?host=... — looks up which store's
// slug a verified custom domain belongs to. Called only from
// src/middleware.ts, which runs on the Edge runtime and so can't run
// Prisma's engine directly — this ordinary API route runs in the normal
// Node.js runtime and does the real DB lookup on middleware's behalf.
// Only resolves domains that are actually verified — an unverified
// customDomain (DNS not confirmed yet) must never route real storefront
// traffic to that store, which is what customDomainVerified: true in the
// query enforces.
export async function handleResolveDomain(db: ResolveDomainDb, req: Request): Promise<Response> {
  const host = new URL(req.url).searchParams.get("host");
  if (!host) return NextResponse.json({ slug: null });

  const store = await db.store.findFirst({
    where: { customDomain: host.toLowerCase(), customDomainVerified: true },
    select: { slug: true },
  });
  return NextResponse.json({ slug: store?.slug ?? null });
}
