import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateNavMenuItemSchema } from "@/lib/validation";

type NavMenuItemRow = { id: string; storeId: string };

export type NavMenuItemByIdDb = {
  navMenuItem: {
    findUnique: (args: { where: { id: string } }) => Promise<NavMenuItemRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<NavMenuItemRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsNavMenuItem(db: NavMenuItemByIdDb, id: string, merchantId: string) {
  const item = await db.navMenuItem.findUnique({ where: { id } });
  if (!item) return null;
  const store = await db.store.findFirst({ where: { id: item.storeId, merchantId } });
  return store ? item : null;
}

// PATCH /api/nav-menu-items/:id — edit label/url, or reorder via position
// (the dashboard sends the item's new position directly; there's no
// separate "swap"/"move" endpoint for a flat list this short).
export async function handleUpdateNavMenuItem(db: NavMenuItemByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsNavMenuItem(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateNavMenuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const item = await db.navMenuItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/nav-menu-items/:id
export async function handleDeleteNavMenuItem(db: NavMenuItemByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsNavMenuItem(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.navMenuItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
