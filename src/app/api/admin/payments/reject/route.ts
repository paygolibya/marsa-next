import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { paymentId, reason } = await req.json();

    await prisma.payment.update({
      where: { id: paymentId },
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
