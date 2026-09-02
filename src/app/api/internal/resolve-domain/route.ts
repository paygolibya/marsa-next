import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/internal/resolve-domain?host=... — looks up which store's
// slug a verified custom domain belongs to. Called only from
// src/middleware.ts, which runs on the Edge runtime and so can't run
// Prisma's engine directly (there's no stable Node.js middleware runtime
// in this Next.js version) — this ordinary API route runs in the normal
// Node.js runtime and does the real DB lookup on middleware's behalf.
// Not meant to be called from anywhere else; there's no merchant-facing
// use for "what store does this hostname belong to."
export async function GET(req: Request) {
  const host = new URL(req.url).searchParams.get("host");
  if (!host) return NextResponse.json({ slug: null });

  const store = await prisma.store.findFirst({
    where: { customDomain: host.toLowerCase(), customDomainVerified: true },
    select: { slug: true },
  });
  return NextResponse.json({ slug: store?.slug ?? null });
}
