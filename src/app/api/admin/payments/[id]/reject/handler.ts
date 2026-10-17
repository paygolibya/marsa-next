import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

export type RejectPaymentDb = {
  payment: { update: (args: { where: { id: string }; data: { status: string; rejectionReason: string } }) => Promise<unknown> };
};

// POST /api/admin/payments/:id/reject — see route.ts for why this is
// injectable (handler.test.ts).
export async function handleRejectPayment(db: RejectPaymentDb, req: Request, paymentId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { reason } = await readJsonBody(req);
    await db.payment.update({ where: { id: paymentId }, data: { status: "rejected", rejectionReason: reason } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MalformedJsonError) return malformedJsonResponse();
    console.error("Rejection error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to reject payment" }, { status: 500 });
  }
}
