import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateRedirectSchema } from "@/lib/validation";

type RedirectRow = { id: string; storeId: string };

export type RedirectByIdDb = {
  redirect: {
    findUnique: (args: { where: { id: string } }) => Promise<RedirectRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<RedirectRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsRedirect(db: RedirectByIdDb, id: string, merchantId: string) {
  const redirect = await db.redirect.findUnique({ where: { id } });
  if (!redirect) return null;
  const store = await db.store.findFirst({ where: { id: redirect.storeId, merchantId } });
  return store ? redirect : null;
}

// PATCH /api/redirects/:id — only toPath is editable; fromPath is the
// unique source path, fixed once created (changing it is delete + create).
export async function handleUpdateRedirect(db: RedirectByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsRedirect(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateRedirectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const redirect = await db.redirect.update({ where: { id }, data: parsed.data });
    return NextResponse.json(redirect);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/redirects/:id
export async function handleDeleteRedirect(db: RedirectByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsRedirect(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.redirect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
