import test from "node:test";
import assert from "node:assert/strict";
import { sendSubscriptionReminders, type SendRemindersDeps } from "./send-reminders";

const NOW = new Date("2026-11-04T08:00:00Z");
const days = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

function makeDeps(merchants: Record<string, unknown>[], alreadySent: Set<string> = new Set(), failEmail = false) {
  const created: { merchantId: string; type: string; title: string }[] = [];
  const emails: string[] = [];
  const deps: SendRemindersDeps = {
    db: {
      merchant: { findMany: async () => merchants },
      notification: {
        count: async ({ where }) => (alreadySent.has(`${where.merchantId}:${where.type}`) ? 1 : 0),
        create: async ({ data }) => {
          created.push(data);
          return {};
        },
      },
    },
    sendEmail: async (m) => {
      if (failEmail) throw new Error("smtp down");
      emails.push(String(m.email));
    },
    sendPush: async () => ({}),
    now: () => NOW,
  };
  return { deps, created, emails };
}

const merchant = (id: string, end: Date, extra: Record<string, unknown> = {}) => ({
  id,
  name: "Merchant " + id,
  email: `${id}@example.com`,
  subscriptionEndDate: end,
  trialEndsAt: end,
  stores: [{ id: "store-" + id }],
  _count: { payments: 0 },
  ...extra,
});

test("sends the milestone reminder (10/5/2/0) and skips other days", async () => {
  const { deps, created } = makeDeps([merchant("a", days(10)), merchant("b", days(7)), merchant("c", days(0))]);
  const res = await sendSubscriptionReminders(deps);
  assert.equal(res.sent, 2);
  assert.deepEqual(created.map((c) => `${c.merchantId}:${c.type}`), ["a:subscription_reminder_10", "c:subscription_reminder_0"]);
  assert.match(created[0].title, /فترتك التجريبية/);
});

test("never sends the same milestone twice (re-runs are safe)", async () => {
  const { deps, created } = makeDeps([merchant("a", days(5))], new Set(["a:subscription_reminder_5"]));
  const res = await sendSubscriptionReminders(deps);
  assert.equal(res.sent, 0);
  assert.equal(created.length, 0);
});

test("a paying merchant's renewal reminder has no first-month offer", async () => {
  const { deps, created } = makeDeps([merchant("p", days(2), { trialEndsAt: days(-40), _count: { payments: 1 } })]);
  await sendSubscriptionReminders(deps);
  assert.match(created[0].title, /اشتراكك ينتهي خلال يومين/);
});

test("a failing email doesn't stop the reminder or the other merchants", async () => {
  const { deps, created } = makeDeps([merchant("a", days(10)), merchant("b", days(5))], new Set(), true);
  const res = await sendSubscriptionReminders(deps);
  assert.equal(res.sent, 2);
  assert.equal(created.length, 2);
});
