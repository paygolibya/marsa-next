import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  try {
    const { tier } = await req.json();

    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        subscriptionTier: tier || "starter",
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
