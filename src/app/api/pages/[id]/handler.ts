import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updatePageSchema } from "@/lib/validation";

type PageRow = { id: string; storeId: string };

export type PageByIdDb = {
  page: {
    findUnique: (args: { where: { id: string } }) => Promise<PageRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<PageRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsPage(db: PageByIdDb, id: string, merchantId: string) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return null;
  const store = await db.store.findFirst({ where: { id: page.storeId, merchantId } });
  return store ? page : null;
}

// PATCH /api/pages/:id — edit title/content. slug never changes after
// creation — same reasoning as Category's slug (it's a real URL path
// segment; changing it would break any bookmarked/shared link).
export async function handleUpdatePage(db: PageByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsPage(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updatePageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const page = await db.page.update({ where: { id }, data: parsed.data });
    return NextResponse.json(page);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/pages/:id
export async function handleDeletePage(db: PageByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsPage(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.page.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
