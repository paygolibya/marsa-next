import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type PaymentRow = { id: string; status: string; createdAt: Date; merchant: unknown };

export type ListPaymentsDb = {
  payment: {
    findMany: (args: {
      where: { status: string };
      include: { merchant: true };
      orderBy: { createdAt: "desc" };
      take: 500;
    }) => Promise<PaymentRow[]>;
  };
};

// GET /api/admin/payments?status=... — defaults to "pending" (the queue an
// admin actually needs to act on), but can list any status for review.
export async function handleListPayments(db: ListPaymentsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";

    const payments = await db.payment.findMany({
      where: { status },
      include: { merchant: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}
