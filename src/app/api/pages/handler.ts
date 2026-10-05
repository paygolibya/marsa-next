import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { customAlphabet } from "nanoid";
import { getAuthMerchantId } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createPageSchema } from "@/lib/validation";

// Digits only — same reasoning as Category's slug collision suffix (see
// src/app/api/categories/handler.ts): a page slug is only ever used as a
// URL path segment here, not a hostname, but digits keep it visually
// clean either way.
const numericSuffix = customAlphabet("0123456789", 4);

type PageRow = { id: string; storeId: string; slug: string; title: string; content: string; createdAt: Date };

export type PagesDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  page: {
    findUnique: (args: { where: { storeId_slug: { storeId: string; slug: string } } }) => Promise<PageRow | null>;
    create: (args: { data: { storeId: string; slug: string; title: string; content: string } }) => Promise<PageRow>;
    findMany: (args: { where: { storeId: string }; orderBy: { createdAt: "desc" } }) => Promise<PageRow[]>;
  };
};

// POST /api/pages — create a static page (About us, policy text, ...).
export async function handleCreatePage(db: PagesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, title, content } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    let slug = slugify(title) || numericSuffix();
    const clash = await db.page.findUnique({ where: { storeId_slug: { storeId, slug } } });
    if (clash) slug = `${slug}-${numericSuffix()}`;

    const page = await db.page.create({ data: { storeId, slug, title, content } });
    return NextResponse.json(page, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/pages?storeId=... — list a store's pages.
export async function handleListPages(db: PagesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const pages = await db.page.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(pages);
}
