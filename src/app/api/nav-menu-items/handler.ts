import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createNavMenuItemSchema } from "@/lib/validation";

type NavMenuItemRow = { id: string; storeId: string; label: string; url: string; position: number };

export type NavMenuItemsDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  navMenuItem: {
    count: (args: { where: { storeId: string } }) => Promise<number>;
    create: (args: { data: { storeId: string; label: string; url: string; position: number } }) => Promise<NavMenuItemRow>;
    findMany: (args: { where: { storeId: string }; orderBy: { position: "asc" } }) => Promise<NavMenuItemRow[]>;
  };
};

// POST /api/nav-menu-items — appends a new link to the end of the store's
// header nav (position is always derived server-side from the current
// count, never client-supplied — reordering is a separate PATCH per item).
export async function handleCreateNavMenuItem(db: NavMenuItemsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createNavMenuItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, label, url } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const position = await db.navMenuItem.count({ where: { storeId } });
    const item = await db.navMenuItem.create({ data: { storeId, label, url, position } });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/nav-menu-items?storeId=... — the store's nav, in render order.
export async function handleListNavMenuItems(db: NavMenuItemsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const items = await db.navMenuItem.findMany({ where: { storeId }, orderBy: { position: "asc" } });
  return NextResponse.json(items);
}
