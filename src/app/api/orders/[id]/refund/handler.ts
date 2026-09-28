import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { sendOrderStatusEmail } from "@/lib/integrations/email";

// The exact slice of the Prisma client this route touches — injected so
// tests can supply a fake and verify the route calls it correctly (right
// where clause, right transaction shape, right status codes for a given DB
// state) without a real database. route.ts's `POST` is the only thing
// Next.js itself calls; it just forwards here with the real `prisma`. (Not
// in route.ts itself — Next's route-file export validation only allows
// known handler names like GET/POST, and rejects any other export.)
export type RefundDb = {
  order: {
    findFirst: (args: {
      where: { id: string; store: { merchantId: string } };
      include: { commission: true; store: { select: { slug: true } } };
    }) => Promise<{
      id: string;
      status: string;
      buyerName: string;
      buyerEmail: string | null;
      totalCents: number;
      commission: { id: string; payoutId: string | null } | null;
      store: { slug: string };
    } | null>;
  };
  $transaction: (fn: (tx: RefundTxDb) => Promise<void>) => Promise<void>;
};
type RefundTxDb = {
  order: {
    update: (args: {
      where: { id: string };
      data: { status: string; refundedAt: Date; refundReason: string | undefined };
    }) => Promise<unknown>;
  };
  commission: { update: (args: { where: { id: string }; data: { status: string } }) => Promise<unknown> };
};

// Important limitation, not a bug: no Moamalat refund/void API exists (see
// docs/moamalat.md) — this route records the refund internally (order
// status, an audit trail, excluding an unbatched Commission from the next
// payout) but does NOT itself move any money. A wallet order's actual
// refund to the buyer is a manual bank-side action outside this system;
// this is the record of "that happened," triggered by the merchant.
//
// Commission clawback: if this order's Commission hasn't been swept into a
// Payout batch yet (payoutId still null), it's safe to just exclude it by
// flipping its status — the weekly batch only picks up status:"calculated"
// rows. If it's already batched (payoutId set) — and especially once that
// Payout was transferred — there is no ledger/adjustment mechanism in the
// current schema to claw back money already paid to the merchant. That
// case is reported back honestly in the response rather than silently
// doing nothing or, worse, mutating historical Commission/Payout rows.
export async function handleRefund(db: RefundDb, req: Request, orderId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const reason: string | undefined = typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;

  const order = await db.order.findFirst({
    where: { id: orderId, store: { merchantId } },
    include: { commission: true, store: { select: { slug: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
  if (order.status === "refunded") {
    return NextResponse.json({ error: "هذا الطلب مسترد بالفعل" }, { status: 400 });
  }

  let commissionClawbackNote: string | null = null;

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "refunded", refundedAt: new Date(), refundReason: reason },
    });

    if (order.commission) {
      if (order.commission.payoutId === null) {
        // Not yet batched — safe to exclude cleanly from the next weekly
        // payout run.
        await tx.commission.update({ where: { id: order.commission.id }, data: { status: "refunded" } });
      } else {
        commissionClawbackNote =
          "تم احتساب عمولة هذا الطلب ضمن دفعة مستحقات سابقة — هذا الاسترداد لا يعدّل تلك الدفعة تلقائيًا، راجع الأمر يدويًا مع الإدارة.";
      }
    }
  });

  // Best-effort, outside the transaction — a failed send never undoes the
  // refund record itself.
  await sendOrderStatusEmail(
    { id: order.id, buyerName: order.buyerName, buyerEmail: order.buyerEmail, totalCents: order.totalCents, storeSlug: order.store.slug },
    "refunded"
  );

  return NextResponse.json({ success: true, note: commissionClawbackNote });
}
