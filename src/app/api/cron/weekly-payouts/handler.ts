import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import type { WeeklyBatchResult } from "@/lib/payment/payout-processor";

export type WeeklyPayoutsDeps = {
  runWeeklyPayoutBatching: () => Promise<WeeklyBatchResult>;
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
  logCronRun: (params: {
    jobName: string;
    status: "success" | "failed";
    ordersProcessed?: number;
    payoutsCreated?: number;
    errorMessage?: string | null;
    durationMs: number;
  }) => Promise<unknown>;
};

async function runAndLogWeeklyPayouts(deps: WeeklyPayoutsDeps): Promise<Response> {
  const startedAt = Date.now();
  try {
    const result = await deps.withRetry(() => deps.runWeeklyPayoutBatching());
    await deps.logCronRun({
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
    await deps.logCronRun({ jobName: "weekly-payouts", status: "failed", errorMessage, durationMs: Date.now() - startedAt });
    console.error("weekly-payouts cron failed:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Runs Friday 9am UTC (see vercel.json). Bundles every un-batched
// Commission (created automatically as orders were delivered through the
// week) into one Payout per merchant, ready for an admin to transfer.
// Same GET-based Vercel Cron auth as /api/cron/process-deliveries.
export async function handleWeeklyPayouts(deps: WeeklyPayoutsDeps, req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET is not set — /api/cron/weekly-payouts is unauthenticated. Set it before going live.");
  }

  return runAndLogWeeklyPayouts(deps);
}

// Manual recovery path for an admin — same rationale as
// /api/cron/process-deliveries's POST handler. Deliberately does NOT
// delegate to handleWeeklyPayouts/re-check CRON_SECRET: that header
// holds this request's admin JWT, never the cron secret, so reusing the
// GET path here would make this route permanently unreachable the
// moment CRON_SECRET is actually configured — a real bug caught while
// porting this to DI, not a hypothetical. Admin JWT auth is its own,
// separate, equally-real authentication — it doesn't need the cron
// secret on top of it.
export async function handleWeeklyPayoutsManualTrigger(deps: WeeklyPayoutsDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return runAndLogWeeklyPayouts(deps);
}
