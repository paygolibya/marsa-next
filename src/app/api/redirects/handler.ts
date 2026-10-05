import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createRedirectSchema } from "@/lib/validation";

type RedirectRow = { id: string; storeId: string; fromPath: string; toPath: string };

export type RedirectsDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  redirect: {
    create: (args: { data: { storeId: string; fromPath: string; toPath: string } }) => Promise<RedirectRow>;
    findMany: (args: { where: { storeId: string } }) => Promise<RedirectRow[]>;
  };
};

// POST /api/redirects — a storefront-path redirect (e.g. a renamed
// product URL shared externally before the rename).
export async function handleCreateRedirect(db: RedirectsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createRedirectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, fromPath, toPath } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    try {
      const redirect = await db.redirect.create({ data: { storeId, fromPath, toPath } });
      return NextResponse.json(redirect, { status: 201 });
    } catch (err) {
      // Unique constraint on (storeId, fromPath) — this exact source path
      // already has a redirect configured.
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "يوجد إعادة توجيه بهذا المسار بالفعل" }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/redirects?storeId=... — list a store's redirects.
export async function handleListRedirects(db: RedirectsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const redirects = await db.redirect.findMany({ where: { storeId } });
  return NextResponse.json(redirects);
}
