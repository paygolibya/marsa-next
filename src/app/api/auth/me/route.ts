import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, toMerchantDTO } from "@/lib/auth";
import { expireIfLapsed } from "@/lib/subscription/expire";

// GET /api/auth/me — refresh the merchant's own record (used to pick up
// subscriptionStatus changes, e.g. after an admin approves the account,
// without forcing a re-login). Also the lazy trigger for subscription/
// trial expiry — see src/lib/subscription/expire.ts.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  await expireIfLapsed(merchantId);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  return NextResponse.json({ merchant: toMerchantDTO(merchant) });
}
