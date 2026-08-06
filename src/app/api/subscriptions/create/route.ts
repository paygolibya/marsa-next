import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  try {
    const { tier, selectedPaymentMethod, dpayEnabled, directWireEnabled, receiptUploadEnabled, codEnabled, allowMultiplePaymentMethods, apiAccessEnabled } = await req.json();

    const normalizedTier = tier === "professional" || tier === "advanced" ? tier : "basic";

    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        subscriptionTier: normalizedTier,
        selectedPaymentMethod: selectedPaymentMethod || null,
        dpayEnabled: Boolean(dpayEnabled),
        directWireEnabled: Boolean(directWireEnabled),
        receiptUploadEnabled: Boolean(receiptUploadEnabled),
        codEnabled: Boolean(codEnabled),
        allowMultiplePaymentMethods: Boolean(allowMultiplePaymentMethods),
        apiAccessEnabled: Boolean(apiAccessEnabled),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
