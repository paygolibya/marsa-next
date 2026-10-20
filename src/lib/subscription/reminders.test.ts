import test from "node:test";
import assert from "node:assert/strict";
import { buildReminder, daysUntilEnd, reminderDue } from "./reminders";

const now = new Date("2026-11-04T08:00:00Z"); // 10:00 Tripoli

test("counts calendar days in Tripoli time", () => {
  assert.equal(daysUntilEnd(new Date("2026-11-14T20:00:00Z"), now), 10);
  assert.equal(daysUntilEnd(new Date("2026-11-04T21:30:00Z"), now), 0, "23:30 Tripoli the same day is still today");
  assert.equal(daysUntilEnd(new Date("2026-11-04T22:30:00Z"), now), 1, "00:30 Tripoli is tomorrow");
});

test("fires only on the 10 / 5 / 2 / 0-day milestones", () => {
  const at = (d: number) => new Date(now.getTime() + d * 86_400_000);
  assert.equal(reminderDue(at(10), now), 10);
  assert.equal(reminderDue(at(5), now), 5);
  assert.equal(reminderDue(at(2), now), 2);
  assert.equal(reminderDue(at(0), now), 0);
  for (const d of [11, 9, 6, 4, 3, 1]) assert.equal(reminderDue(at(d), now), null, String(d));
});

test("trial reminder mentions the paused store and the 75 LYD first month", () => {
  const r = buildReminder(5, { isTrial: true, firstPaymentDiscount: true });
  assert.match(r.title, /فترتك التجريبية تنتهي خلال 5 أيام/);
  assert.match(r.body, /يتوقف متجرك/);
  assert.match(r.body, /75 د.ل/);
  assert.equal(r.link, "/subscription");
});

test("renewal reminder for a paying merchant has no first-month offer", () => {
  const r = buildReminder(0, { isTrial: false, firstPaymentDiscount: false });
  assert.match(r.title, /اشتراكك ينتهي اليوم/);
  assert.doesNotMatch(r.body, /75/);
});
