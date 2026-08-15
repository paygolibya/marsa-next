import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { markPayoutPaidSchema } from "@/lib/validation";

// POST /api/admin/payouts/:id/mark-paid — { note? }. Logged for reference
// only, no automatic bank transfer happens here — the admin has already
// sent the money manually and is recording that fact.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(adminId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = markPayoutPaidSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }
    // Prevent duplicate payouts: a payout already marked completed cannot
    // be marked again (would otherwise let a second transfer be logged
    // against the same money).
    if (payout.status === "completed") {
      return NextResponse.json({ error: "تم تحويل هذه الدفعة بالفعل" }, { status: 409 });
    }

    const [updatedPayout] = await prisma.$transaction([
      prisma.payout.update({
        where: { id },
        data: {
          status: "completed",
          markedPaidAt: new Date(),
          markedPaidBy: adminId,
          note: parsed.data.note ?? payout.note,
        },
      }),
      prisma.commission.updateMany({ where: { payoutId: id }, data: { status: "paid" } }),
    ]);

    return NextResponse.json(updatedPayout);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
