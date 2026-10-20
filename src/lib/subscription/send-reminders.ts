import { buildReminder, reminderDue, reminderType, type ReminderDay } from "@/lib/subscription/reminders";

type ReminderMerchant = {
  id: string;
  name: string;
  email: string | null;
  subscriptionEndDate: Date | null;
  trialEndsAt: Date | null;
  stores: { id: string }[];
  _count: { payments: number };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose args so
// the real PrismaClient structurally satisfies this (same pattern as
// orders/handler.ts); rows are typed at the call site below.
type Any = any;

export type SendRemindersDeps = {
  db: {
    merchant: {
      findMany: (args: Any) => Promise<Any[]>;
    };
    notification: {
      count: (args: { where: { merchantId: string; type: string; createdAt: { gte: Date } } }) => Promise<number>;
      create: (args: { data: { merchantId: string; storeId: string | null; type: string; title: string; body: string; link: string } }) => Promise<unknown>;
    };
  };
  sendEmail: (merchant: { email: string | null; name: string }, reminder: { title: string; body: string }) => Promise<void>;
  sendPush: (merchantId: string, payload: { title: string; body: string; link: string }) => Promise<unknown>;
  now?: () => Date;
};

export type SendRemindersResult = { checked: number; sent: number; byDay: Record<string, number>; errors: string[] };

// Daily: every active merchant whose trial/paid period ends within the
// next 10 days gets the reminder for today's milestone (10/5/2/0 days
// left) — once. The Notification row doubles as the "already sent" record:
// a milestone is skipped if a notification of that type exists since 12
// days before this period's end, so a re-run (or a manual trigger) never
// sends twice, while the next period's reminders still go out.
export async function sendSubscriptionReminders(deps: SendRemindersDeps): Promise<SendRemindersResult> {
  const now = deps.now ? deps.now() : new Date();
  const horizon = new Date(now.getTime() + 11 * 86_400_000);
  const merchants: ReminderMerchant[] = await deps.db.merchant.findMany({
    where: { subscriptionStatus: "active", subscriptionEndDate: { gte: new Date(now.getTime() - 86_400_000), lte: horizon } },
    select: {
      id: true,
      name: true,
      email: true,
      subscriptionEndDate: true,
      trialEndsAt: true,
      stores: { select: { id: true } },
      _count: { select: { payments: { where: { status: "approved" } } } },
    },
  });

  const result: SendRemindersResult = { checked: merchants.length, sent: 0, byDay: {}, errors: [] };
  for (const m of merchants) {
    if (!m.subscriptionEndDate) continue;
    const day: ReminderDay | null = reminderDue(m.subscriptionEndDate, now);
    if (day === null) continue;
    try {
      const type = reminderType(day);
      const since = new Date(m.subscriptionEndDate.getTime() - 12 * 86_400_000);
      if ((await deps.db.notification.count({ where: { merchantId: m.id, type, createdAt: { gte: since } } })) > 0) continue;

      const isTrial = Boolean(m.trialEndsAt) && m.trialEndsAt!.getTime() === m.subscriptionEndDate.getTime();
      const reminder = buildReminder(day, { isTrial, firstPaymentDiscount: m._count.payments === 0 });
      await deps.db.notification.create({
        data: { merchantId: m.id, storeId: m.stores[0]?.id ?? null, type, title: reminder.title, body: reminder.body, link: reminder.link },
      });
      // Best-effort channels on top of the in-app row (same convention as
      // notify.ts): a failed email/push must not stop the other merchants.
      await Promise.allSettled([deps.sendEmail(m, reminder), deps.sendPush(m.id, reminder)]);
      result.sent += 1;
      result.byDay[String(day)] = (result.byDay[String(day)] ?? 0) + 1;
    } catch (error) {
      result.errors.push(`${m.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
