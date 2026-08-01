import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId, reason } = await req.json();

    await prisma.merchant.update({
      where: { id: targetMerchantId },
      data: {
        subscriptionStatus: "rejected",
      },
    });

    return NextResponse.json({ success: true, reason });
  } catch (error) {
    console.error("Error rejecting merchant:", error);
    return NextResponse.json({ error: "Failed to reject merchant" }, { status: 500 });
  }
}
