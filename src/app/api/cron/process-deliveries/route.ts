import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { processRecentDeliveries, withRetry, logCronRun } from "@/lib/payment/payout-processor";

// Vercel Cron Jobs call this route with GET (not POST — the platform's
// actual invocation method, unlike what some integration guides assume),
// sending `Authorization: Bearer $CRON_SECRET` automatically once
// CRON_SECRET is set as an env var and the schedule is declared in
// vercel.json. Runs daily at 8am UTC, catching any order the real-time
// webhook trigger (src/app/api/vanex/webhook/route.ts) missed.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET is not set — /api/cron/process-deliveries is unauthenticated. Set it before going live.");
  }

  const startedAt = Date.now();
  try {
    const result = await withRetry(() => processRecentDeliveries(24));
    await logCronRun({
      jobName: "process-deliveries",
      status: result.errors.length > 0 && result.payoutsCreated === 0 ? "failed" : "success",
      ordersProcessed: result.ordersProcessed,
      payoutsCreated: result.payoutsCreated,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logCronRun({ jobName: "process-deliveries", status: "failed", errorMessage, durationMs: Date.now() - startedAt });
    console.error("process-deliveries cron failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Manual recovery path for an admin (e.g. via curl) if the daily cron was
// missed or a batch of orders needs reprocessing immediately — not exposed
// anywhere in the UI, since calculation itself has no manual step by design.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return GET(req);
}
