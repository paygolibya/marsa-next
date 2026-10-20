import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import type { SendRemindersResult } from "@/lib/subscription/send-reminders";

export type SubscriptionRemindersDeps = {
  sendSubscriptionReminders: () => Promise<SendRemindersResult>;
  logCronRun: (params: {
    jobName: string;
    status: "success" | "failed";
    ordersProcessed?: number;
    payoutsCreated?: number;
    errorMessage?: string | null;
    durationMs: number;
  }) => Promise<unknown>;
  isAdmin?: (merchantId: string | null) => Promise<boolean>;
};

async function run(deps: SubscriptionRemindersDeps): Promise<Response> {
  const startedAt = Date.now();
  try {
    const result = await deps.sendSubscriptionReminders();
    await deps.logCronRun({
      jobName: "subscription-reminders",
      status: result.errors.length > 0 && result.sent === 0 ? "failed" : "success",
      ordersProcessed: result.checked, // CronLog's generic counters: merchants checked / reminders sent
      payoutsCreated: result.sent,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await deps.logCronRun({ jobName: "subscription-reminders", status: "failed", errorMessage, durationMs: Date.now() - startedAt });
    console.error("subscription-reminders cron failed:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/cron/subscription-reminders — Vercel Cron, daily at 08:00 UTC
// (10:00 Libya, so nobody gets a push at dawn). Same CRON_SECRET guard as
// the other cron routes.
export async function handleSubscriptionReminders(deps: SubscriptionRemindersDeps, req: Request): Promise<Response> {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET) {
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  } else {
    console.warn("CRON_SECRET is not set — /api/cron/subscription-reminders is unauthenticated. Set it before going live.");
  }
  return run(deps);
}

// POST — manual admin trigger (safe to repeat: already-sent milestones are skipped).
export async function handleSubscriptionRemindersManualTrigger(deps: SubscriptionRemindersDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await (deps.isAdmin ?? isAdminMerchantId)(merchantId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return run(deps);
}
