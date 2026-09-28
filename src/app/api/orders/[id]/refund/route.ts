import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { sendOrderStatusEmail } from "@/lib/integrations/email";

// POST /api/orders/:id/refund — merchant-scoped (their own store's order
// only, same ownership pattern as every other order/store route).
//
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
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason: string | undefined = typeof body?.reason === "string" ? body.reason.slice(0, 500) : undefined;

  const order = await prisma.order.findFirst({
    where: { id, store: { merchantId } },
    include: { commission: true, store: { select: { slug: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
  if (order.status === "refunded") {
    return NextResponse.json({ error: "هذا الطلب مسترد بالفعل" }, { status: 400 });
  }

  let commissionClawbackNote: string | null = null;

  await prisma.$transaction(async (tx) => {
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
