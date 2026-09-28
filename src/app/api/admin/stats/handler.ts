import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export type AdminStatsDb = {
  merchant: { count: () => Promise<number> };
  order: { count: () => Promise<number> };
  payment: {
    aggregate: (args: { where: { status: "approved" }; _sum: { amount: true } }) => Promise<{ _sum: { amount: number | null } }>;
    count: (args: { where: { status: "pending" } }) => Promise<number>;
  };
};

// GET /api/admin/stats — dashboard summary numbers. revenue is a
// database-side aggregate sum, not fetch-everything-and-add-in-app-memory
// — scales the same whether there are 10 or 10 million approved payments.
export async function handleAdminStats(db: AdminStatsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const merchants = await db.merchant.count();
    const orders = await db.order.count();
    const approvedRevenue = await db.payment.aggregate({ where: { status: "approved" }, _sum: { amount: true } });
    const pendingPayments = await db.payment.count({ where: { status: "pending" } });

    const revenue = approvedRevenue._sum.amount ?? 0;

    return NextResponse.json({ merchants, orders, revenue, pendingPayments });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
