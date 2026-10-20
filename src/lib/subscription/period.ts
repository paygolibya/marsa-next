// Real calendar-month arithmetic (not periodMonths * 30 days) so a
// 12-month period lands on the same date next year rather than drifting
// ~5 days short from treating every month as exactly 30 days. Shared
// between the automatic Moamalat-confirmed activation
// (moamalat-subscription.ts) and the manual admin-approval activation
// (admin/payments/[id]/approve) — these two paths are supposed to be the
// exact same activation, just automatic vs. human-triggered (see the
// comment on finalizeSubscriptionPayment), and before this were NOT: the
// admin route hardcoded a flat 30 days regardless of what period the
// merchant actually paid for (1/3/12 months), silently shortchanging
// anyone approved manually for a 3- or 12-month plan.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// End date of a newly paid period. Paying before the current period
// (trial or paid) ends now stacks on top of it instead of restarting from
// today — before this, a merchant who paid 10 days before their trial
// ended silently lost those 10 days, which punished exactly the early
// payment the trial-end reminders ask for. A lapsed merchant starts from
// today.
export function paidPeriodEnd(currentEnd: Date | string | null | undefined, months: number, now: Date = new Date()): Date {
  const end = currentEnd ? new Date(currentEnd) : null;
  const base = end && end.getTime() > now.getTime() ? end : now;
  return addMonths(base, months);
}
