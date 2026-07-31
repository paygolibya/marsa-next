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
    const approvedPayments = await prisma.payment.findMany({ where: { status: "approved" } });
    const pendingPayments = await prisma.payment.count({ where: { status: "pending" } });

    const revenue = approvedPayments.reduce((sum, payment) => sum + payment.amount, 0);

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
