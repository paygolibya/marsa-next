import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { transferPayoutSchema } from "@/lib/validation";

type Payout = { id: string; status: string; transferReference: string | null; note: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- args
// deliberately loose so the real PrismaClient structurally satisfies this
// interface, same pattern/reasoning as the other handler.ts files this
// session (see customize/handler.ts's comment for the full explanation).
// `update`/`updateMany` here return an unresolved "promise" (a real
// PrismaPromise in production, a plain object in tests) rather than being
// awaited directly — the real route uses $transaction's ARRAY form (all
// three writes atomically together), not the callback form, so each call
// must produce something to collect into that array first.
type Any = any;

export type TransferPayoutDb = {
  payout: {
    findUnique: (args: Any) => Promise<Payout | null>;
    update: (args: Any) => Any;
  };
  commission: { updateMany: (args: Any) => Any };
  order: { updateMany: (args: Any) => Any };
  $transaction: (ops: Any[]) => Promise<Any[]>;
};

// POST /api/admin/payouts/transfer — { payoutId, transferReference?, note? }.
// The ONLY manual action in the payout system: everything up to this point
// (commission calculation, weekly batching) happened automatically. This
// just records that the admin sent the money and logs who/when — no
// automatic bank transfer happens here. See route.ts for why this is
// injectable: the double-transfer guard (409 on an already-transferred
// payout) and the three-way coordinated update (payout status, every one
// of its commissions marked paid, every affected order's payoutStatus)
// are exactly the kind of "does the route wire multiple Prisma calls
// together correctly" bug a real financial action deserves coverage for.
export async function handleTransferPayout(db: TransferPayoutDb, req: Request): Promise<Response> {
  const adminId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(adminId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = transferPayoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { payoutId, transferReference, note } = parsed.data;

    const payout = await db.payout.findUnique({ where: { id: payoutId } });
    if (!payout) return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    if (payout.status === "transferred") {
      return NextResponse.json({ error: "تم تحويل هذه الدفعة بالفعل" }, { status: 409 });
    }

    const now = new Date();
    const [updatedPayout] = await db.$transaction([
      db.payout.update({
        where: { id: payoutId },
        data: {
          status: "transferred",
          transferredAt: now,
          transferredBy: adminId,
          transferReference: transferReference ?? payout.transferReference,
          note: note ?? payout.note,
        },
      }),
      db.commission.updateMany({ where: { payoutId }, data: { status: "paid", paidAt: now } }),
      db.order.updateMany({ where: { commission: { payoutId } }, data: { payoutStatus: "transferred", payoutTransferredAt: now } }),
    ]);

    return NextResponse.json(updatedPayout);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
