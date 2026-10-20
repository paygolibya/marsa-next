import { prisma } from "@/lib/prisma";
import { logCronRun } from "@/lib/payment/payout-processor";
import { sendSubscriptionReminders } from "@/lib/subscription/send-reminders";
import { sendMerchantSubscriptionReminderEmail } from "@/lib/integrations/email";
import { sendPushToMerchant } from "@/lib/integrations/push";
import { handleSubscriptionReminders, handleSubscriptionRemindersManualTrigger } from "./handler";

// GET/POST /api/cron/subscription-reminders — see handler.ts.
const deps = {
  sendSubscriptionReminders: () =>
    sendSubscriptionReminders({ db: prisma, sendEmail: sendMerchantSubscriptionReminderEmail, sendPush: sendPushToMerchant }),
  logCronRun,
};

export async function GET(req: Request) {
  return handleSubscriptionReminders(deps, req);
}

export async function POST(req: Request) {
  return handleSubscriptionRemindersManualTrigger(deps, req);
}
