import { tripoliDateKey } from "@/lib/delivery/own-team";

// Trial/subscription-end reminders, sent by the daily
// /api/cron/subscription-reminders job. Merchants who don't open their
// dashboard never saw the in-dashboard "تنتهي خلال X يوم" banner, and with
// storefronts now pausing the moment a period ends (subscription/access.ts)
// they need to hear about it before it happens.

export const REMINDER_DAYS = [10, 5, 2, 0] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

// Calendar days (Africa/Tripoli) from today until the end date's day — 0
// means the period ends today.
export function daysUntilEnd(end: Date, now: Date): number {
  const a = Date.parse(`${tripoliDateKey(now)}T00:00:00Z`);
  const b = Date.parse(`${tripoliDateKey(end)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function reminderDue(end: Date, now: Date): ReminderDay | null {
  const days = daysUntilEnd(end, now);
  return (REMINDER_DAYS as readonly number[]).includes(days) ? (days as ReminderDay) : null;
}

export function reminderType(day: ReminderDay): string {
  return `subscription_reminder_${day}`;
}

// isTrial: the period ending is the free trial. firstPaymentDiscount:
// the merchant has never paid, so the 50%-off first month applies (75 LYD
// instead of 150 — see checkout-features FIRST_PAYMENT_DISCOUNT_LYD).
export function buildReminder(day: ReminderDay, opts: { isTrial: boolean; firstPaymentDiscount: boolean }): { title: string; body: string; link: string } {
  const what = opts.isTrial ? "فترتك التجريبية" : "اشتراكك";
  // فترة is feminine (تنتهي), اشتراك masculine (ينتهي).
  const verb = opts.isTrial ? "تنتهي" : "ينتهي";
  const when = day === 0 ? `${verb} اليوم` : day === 2 ? `${verb} خلال يومين` : `${verb} خلال ${day} أيام`;
  const offer = opts.firstPaymentDiscount ? " أول شهر مدفوع بـ 75 د.ل فقط بدل 150 د.ل." : "";
  const ending = opts.isTrial ? "انتهائها" : "انتهائه";
  const consequence = `${day === 0 ? "بعد" : "عند"} ${ending} يتوقف متجرك عن استقبال الطلبات حتى تشترك.`;
  return {
    title: `${what} ${when}`,
    body: `${consequence} اشترك الآن ليبقى متجرك يعمل بدون انقطاع.${offer}`,
    link: "/subscription",
  };
}
