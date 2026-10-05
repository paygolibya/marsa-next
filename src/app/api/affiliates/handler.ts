import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { customAlphabet } from "nanoid";
import { getAuthMerchantId } from "@/lib/auth";
import { createAffiliateSchema } from "@/lib/validation";

// Uppercase letters + digits, no ambiguous-looking characters — this code
// is read aloud/typed by real people sharing a referral link, unlike
// Category/Page's slugs which only ever appear in a URL a browser copies
// verbatim.
const codeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

type AffiliateRow = {
  id: string;
  storeId: string;
  name: string;
  phone: string;
  code: string;
  commissionPercent: number;
  active: boolean;
  createdAt: Date;
};

export type AffiliatesDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  affiliate: {
    findUnique: (args: { where: { storeId_code: { storeId: string; code: string } } }) => Promise<{ id: string } | null>;
    create: (args: { data: { storeId: string; name: string; phone: string; code: string; commissionPercent?: number } }) => Promise<AffiliateRow>;
    findMany: (args: { where: { storeId: string }; orderBy: { createdAt: "desc" } }) => Promise<AffiliateRow[]>;
  };
  affiliateCommission: {
    findMany: (args: { where: { affiliateId: { in: string[] }; status: "pending" } }) => Promise<{ affiliateId: string; commissionCents: number }[]>;
  };
};

async function generateUniqueCode(db: AffiliatesDb, storeId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = codeAlphabet();
    const clash = await db.affiliate.findUnique({ where: { storeId_code: { storeId, code } } });
    if (!clash) return code;
  }
  // Astronomically unlikely with a 6-char, 33-symbol alphabet — this is
  // just a safety net, not an expected path.
  return codeAlphabet() + codeAlphabet();
}

// POST /api/affiliates — register a new affiliate/referrer for this store.
export async function handleCreateAffiliate(db: AffiliatesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createAffiliateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, name, phone, commissionPercent } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const code = await generateUniqueCode(db, storeId);
    const affiliate = await db.affiliate.create({ data: { storeId, name, phone, code, commissionPercent } });
    return NextResponse.json(affiliate, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/affiliates?storeId=... — list a store's affiliates.
export async function handleListAffiliates(db: AffiliatesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const affiliates = await db.affiliate.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  if (affiliates.length === 0) return NextResponse.json([]);

  const pending = await db.affiliateCommission.findMany({
    where: { affiliateId: { in: affiliates.map((a) => a.id) }, status: "pending" },
  });
  const pendingByAffiliate = new Map<string, number>();
  for (const c of pending) pendingByAffiliate.set(c.affiliateId, (pendingByAffiliate.get(c.affiliateId) ?? 0) + c.commissionCents);

  return NextResponse.json(affiliates.map((a) => ({ ...a, pendingCents: pendingByAffiliate.get(a.id) ?? 0 })));
}
