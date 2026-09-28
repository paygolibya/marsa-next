import { NextResponse } from "next/server";
import { getAuthMerchantId, toMerchantDTO } from "@/lib/auth";

type MerchantRow = Parameters<typeof toMerchantDTO>[0] & { id: string };

export type AuthMeDeps = {
  db: { merchant: { findUnique: (args: { where: { id: string } }) => Promise<MerchantRow | null> } };
  expireIfLapsed: (merchantId: string) => Promise<boolean>;
};

// GET /api/auth/me — refresh the merchant's own record (used to pick up
// subscriptionStatus changes, e.g. after an admin approves the account,
// without forcing a re-login). Also the lazy trigger for subscription/
// trial expiry — see src/lib/subscription/expire.ts.
export async function handleMe(deps: AuthMeDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  await deps.expireIfLapsed(merchantId);

  const merchant = await deps.db.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  return NextResponse.json({ merchant: toMerchantDTO(merchant) });
}
