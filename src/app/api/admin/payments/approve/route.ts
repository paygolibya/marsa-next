import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { paymentId } = await req.json();

    const payment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "approved",
        approvedAt: new Date(),
      },
    });

    await prisma.merchant.update({
      where: { id: payment.merchantId },
      data: {
        subscriptionTier: payment.tier,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Failed to approve payment" }, { status: 500 });
  }
}
