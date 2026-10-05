import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateAffiliateSchema } from "@/lib/validation";

type AffiliateRow = { id: string; storeId: string };

export type AffiliateByIdDb = {
  affiliate: {
    findUnique: (args: { where: { id: string } }) => Promise<AffiliateRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<AffiliateRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsAffiliate(db: AffiliateByIdDb, id: string, merchantId: string) {
  const affiliate = await db.affiliate.findUnique({ where: { id } });
  if (!affiliate) return null;
  const store = await db.store.findFirst({ where: { id: affiliate.storeId, merchantId } });
  return store ? affiliate : null;
}

// PATCH /api/affiliates/:id — edit name/phone/commissionPercent, or
// toggle active. code never changes after creation — it's a real shared
// link, same reasoning as every other generated code/slug in this app.
export async function handleUpdateAffiliate(db: AffiliateByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsAffiliate(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateAffiliateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const affiliate = await db.affiliate.update({ where: { id }, data: parsed.data });
    return NextResponse.json(affiliate);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/affiliates/:id
export async function handleDeleteAffiliate(db: AffiliateByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsAffiliate(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.affiliate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
