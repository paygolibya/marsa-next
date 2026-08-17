import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { transferPayoutSchema } from "@/lib/validation";

// POST /api/admin/payouts/transfer — { payoutId, transferReference?, note? }.
// The ONLY manual action in this system: everything up to this point
// (commission calculation, weekly batching) happened automatically. This
// just records that the admin sent the money and logs who/when — no
// automatic bank transfer happens here.
export async function POST(req: Request) {
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

    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }
    // Prevent a duplicate transfer being logged against the same money.
    if (payout.status === "transferred") {
      return NextResponse.json({ error: "تم تحويل هذه الدفعة بالفعل" }, { status: 409 });
    }

    const now = new Date();
    const [updatedPayout] = await prisma.$transaction([
      prisma.payout.update({
        where: { id: payoutId },
        data: {
          status: "transferred",
          transferredAt: now,
          transferredBy: adminId,
          transferReference: transferReference ?? payout.transferReference,
          note: note ?? payout.note,
        },
      }),
      prisma.commission.updateMany({ where: { payoutId }, data: { status: "paid", paidAt: now } }),
      prisma.order.updateMany({
        where: { commission: { payoutId } },
        data: { payoutStatus: "transferred", payoutTransferredAt: now },
      }),
    ]);

    return NextResponse.json(updatedPayout);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
