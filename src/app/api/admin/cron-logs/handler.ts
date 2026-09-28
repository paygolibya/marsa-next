import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type CronLogRow = { id: string; jobName: string; status: string; executedAt: Date };

export type CronLogsDb = {
  cronLog: { findMany: (args: { orderBy: { executedAt: "desc" }; take: 100 }) => Promise<CronLogRow[]> };
};

// GET /api/admin/cron-logs — last 100 automatic cron executions, newest
// first. Lets an admin see the daily/weekly jobs actually ran without
// needing Vercel's own logs.
export async function handleCronLogs(db: CronLogsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await db.cronLog.findMany({
    orderBy: { executedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ logs });
}
