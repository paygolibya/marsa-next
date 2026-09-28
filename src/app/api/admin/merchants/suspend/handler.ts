import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export type SuspendMerchantDb = {
  merchant: { update: (args: { where: { id: string }; data: { subscriptionStatus: string } }) => Promise<unknown> };
};

export async function handleSuspendMerchant(db: SuspendMerchantDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId } = await req.json();

    await db.merchant.update({
      where: { id: targetMerchantId },
      data: { subscriptionStatus: "suspended" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error suspending merchant:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to suspend merchant" }, { status: 500 });
  }
}
