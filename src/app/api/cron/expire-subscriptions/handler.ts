import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export type ExpireSubscriptionsDeps = {
  expireAllLapsed: () => Promise<{ expiredCount: number }>;
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
  logCronRun: (params: {
    jobName: string;
    status: "success" | "failed";
    payoutsCreated?: number;
    errorMessage?: string | null;
    durationMs: number;
  }) => Promise<unknown>;
};

async function runAndLogExpireSubscriptions(deps: ExpireSubscriptionsDeps): Promise<Response> {
  const startedAt = Date.now();
  try {
    const result = await deps.withRetry(() => deps.expireAllLapsed());
    await deps.logCronRun({
      jobName: "expire-subscriptions",
      status: "success",
      payoutsCreated: result.expiredCount, // reusing CronLog's generic counters — "count of things this run changed"
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await deps.logCronRun({ jobName: "expire-subscriptions", status: "failed", errorMessage, durationMs: Date.now() - startedAt });
    console.error("expire-subscriptions cron failed:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Daily backstop for subscription/trial expiry — the lazy check in
// /api/auth/login and /api/auth/me handles it the moment an affected
// merchant next logs in, but this is what keeps the admin's merchant list
// accurate even for one who doesn't. Same GET-for-Vercel-Cron,
// POST-for-manual-admin-recovery shape as the payout cron routes, and
// reuses their CronLog table/withRetry helper rather than duplicating them.
export async function handleExpireSubscriptions(deps: ExpireSubscriptionsDeps, req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn("CRON_SECRET is not set — /api/cron/expire-subscriptions is unauthenticated. Set it before going live.");
  }

  return runAndLogExpireSubscriptions(deps);
}

// Deliberately does NOT delegate to handleExpireSubscriptions/re-check
// CRON_SECRET — see weekly-payouts/handler.ts for why that would make
// this route permanently unreachable once CRON_SECRET is configured.
export async function handleExpireSubscriptionsManualTrigger(deps: ExpireSubscriptionsDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return runAndLogExpireSubscriptions(deps);
}
