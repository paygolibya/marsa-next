import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

type AffiliateRow = { id: string; storeId: string };
type PendingCommission = { id: string; commissionCents: number };
type PayoutRow = { id: string; affiliateId: string; amountCents: number; status: string; createdAt: Date };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- args
// deliberately loose, same pattern (and reasoning) as OrdersTx in
// src/app/api/orders/handler.ts.
type Any = any;

export type AffiliatePayoutDb = {
  affiliate: { findUnique: (args: { where: { id: string } }) => Promise<AffiliateRow | null> };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  affiliateCommission: { findMany: (args: { where: { affiliateId: string; status: "pending" } }) => Promise<PendingCommission[]> };
  $transaction: Any;
};

type PayoutTx = {
  affiliatePayout: { create: (args: Any) => Promise<PayoutRow> };
  affiliateCommission: { updateMany: (args: Any) => Promise<unknown> };
};

// POST /api/affiliates/:id/payout — the merchant marking all of this
// affiliate's currently-pending commissions as paid out, after actually
// transferring the money themselves (bank transfer, cash, whatever) — V1
// is manual, no automated batching yet, same as Payout/Commission
// started before their own weekly cron existed. The create+updateMany
// pair runs in one transaction, same pattern as the existing
// Payout/Commission batching in src/lib/payment/payout-processor.ts.
export async function handleCreateAffiliatePayout(db: AffiliatePayoutDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const affiliate = await db.affiliate.findUnique({ where: { id } });
    if (!affiliate) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    const store = await db.store.findFirst({ where: { id: affiliate.storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const pending = await db.affiliateCommission.findMany({ where: { affiliateId: id, status: "pending" } });
    if (pending.length === 0) {
      return NextResponse.json({ error: "لا توجد عمولات مستحقة لهذا المسوّق" }, { status: 400 });
    }

    const amountCents = pending.reduce((sum, c) => sum + c.commissionCents, 0);

    const payout = await db.$transaction(async (tx: PayoutTx) => {
      const created = await tx.affiliatePayout.create({
        data: { affiliateId: id, amountCents, status: "transferred", transferredAt: new Date() },
      });
      await tx.affiliateCommission.updateMany({
        where: { id: { in: pending.map((c) => c.id) } },
        data: { status: "paid", payoutId: created.id },
      });
      return created;
    });

    return NextResponse.json(payout, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
