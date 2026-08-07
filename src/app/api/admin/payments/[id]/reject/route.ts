import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { reason } = await req.json();

    await prisma.payment.update({
      where: { id },
      data: {
        status: "rejected",
        rejectionReason: reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rejection error:", error);
    return NextResponse.json({ error: "Failed to reject payment" }, { status: 500 });
  }
}
