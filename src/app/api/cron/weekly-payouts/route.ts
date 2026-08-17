import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { runWeeklyPayoutBatching, withRetry, logCronRun } from "@/lib/payment/payout-processor";

// Runs Friday 9am UTC (see vercel.json). Bundles every un-batched
// Commission (created automatically as orders were delivered through the
// week) into one Payout per merchant, ready for an admin to transfer.
// Same GET-based Vercel Cron auth as /api/cron/process-deliveries.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET is not set — /api/cron/weekly-payouts is unauthenticated. Set it before going live.");
  }

  const startedAt = Date.now();
  try {
    const result = await withRetry(() => runWeeklyPayoutBatching());
    await logCronRun({
      jobName: "weekly-payouts",
      status: result.errors.length > 0 && result.merchantsCount === 0 ? "failed" : "success",
      ordersProcessed: result.commissionsCount,
      payoutsCreated: result.merchantsCount,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logCronRun({ jobName: "weekly-payouts", status: "failed", errorMessage, durationMs: Date.now() - startedAt });
    console.error("weekly-payouts cron failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Manual recovery path for an admin — same rationale as
// /api/cron/process-deliveries's POST handler.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return GET(req);
}
