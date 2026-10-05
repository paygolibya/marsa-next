import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateUpsellSchema } from "@/lib/validation";

type UpsellRow = { id: string; storeId: string };

export type UpsellByIdDb = {
  upsell: {
    findUnique: (args: { where: { id: string } }) => Promise<UpsellRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<UpsellRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsUpsell(db: UpsellByIdDb, id: string, merchantId: string) {
  const upsell = await db.upsell.findUnique({ where: { id } });
  if (!upsell) return null;
  const store = await db.store.findFirst({ where: { id: upsell.storeId, merchantId } });
  return store ? upsell : null;
}

// PATCH /api/upsells/:id — only `active` is editable; the trigger/offered
// pair is fixed once created (changing it is just deleting and recreating
// with the new pair, matching Coupon's own "fields are fixed" pattern).
export async function handleUpdateUpsell(db: UpsellByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsUpsell(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateUpsellSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const upsell = await db.upsell.update({ where: { id }, data: parsed.data });
    return NextResponse.json(upsell);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/upsells/:id
export async function handleDeleteUpsell(db: UpsellByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsUpsell(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.upsell.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
