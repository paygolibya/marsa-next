import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

export type RejectMerchantDb = {
  merchant: { update: (args: { where: { id: string }; data: { subscriptionStatus: string } }) => Promise<unknown> };
};

export async function handleRejectMerchant(db: RejectMerchantDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId, reason } = await readJsonBody(req);

    await db.merchant.update({
      where: { id: targetMerchantId },
      data: { subscriptionStatus: "rejected" },
    });

    return NextResponse.json({ success: true, reason });
  } catch (error) {
    if (error instanceof MalformedJsonError) return malformedJsonResponse();
    console.error("Error rejecting merchant:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to reject merchant" }, { status: 500 });
  }
}
