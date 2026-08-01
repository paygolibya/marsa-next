import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId } = await req.json();

    await prisma.merchant.update({
      where: { id: targetMerchantId },
      data: {
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting merchant:", error);
    return NextResponse.json({ error: "Failed to accept merchant" }, { status: 500 });
  }
}
