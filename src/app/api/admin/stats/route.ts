import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const merchants = await prisma.merchant.count();
    const orders = await prisma.order.count();
    // Was: fetch every approved Payment row into app memory just to sum
    // one column — an unbounded findMany that grows forever and gets
    // slower every day. A database-side aggregate sum scales the same
    // whether there are 10 or 10 million approved payments.
    const approvedRevenue = await prisma.payment.aggregate({ where: { status: "approved" }, _sum: { amount: true } });
    const pendingPayments = await prisma.payment.count({ where: { status: "pending" } });

    const revenue = approvedRevenue._sum.amount ?? 0;

    return NextResponse.json({
      merchants,
      orders,
      revenue,
      pendingPayments,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
