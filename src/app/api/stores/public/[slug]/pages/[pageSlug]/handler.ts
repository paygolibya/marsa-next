import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

type PageRow = { title: string; content: string };

export type PublicPageDb = {
  store: { findUnique: (args: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null> };
  page: {
    findUnique: (args: { where: { storeId_slug: { storeId: string; slug: string } } }) => Promise<PageRow | null>;
  };
};

// GET /api/stores/public/:slug/pages/:pageSlug — a merchant's static page
// (About us, policy text, ...), rendered at /store/{slug}/page/{pageSlug}.
export async function handleGetPublicPage(db: PublicPageDb, storeSlug: string, pageSlug: string): Promise<Response> {
  try {
    const store = await db.store.findUnique({ where: { slug: storeSlug }, select: { id: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const page = await db.page.findUnique({ where: { storeId_slug: { storeId: store.id, slug: pageSlug } } });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    return NextResponse.json(page);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
