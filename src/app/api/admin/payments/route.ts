import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";

    const payments = await prisma.payment.findMany({
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
