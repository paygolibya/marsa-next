import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

// GET /api/admin/cron-logs — last 100 automatic cron executions, newest
// first. Lets an admin see the daily/weekly jobs actually ran without
// needing Vercel's own logs.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.cronLog.findMany({
    orderBy: { executedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}
