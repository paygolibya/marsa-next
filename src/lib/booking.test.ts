import test from "node:test";
import assert from "node:assert/strict";
import { generateDaySlotMinutes, generateAvailableSlots, isSlotOpen, type WorkingHours } from "./booking";

const HOURS: WorkingHours = {
  "1": { open: "09:00", close: "17:00" }, // Monday
  "2": null, // Tuesday: closed
};

test("generates every slot start within working hours at the given interval", () => {
  const slots = generateDaySlotMinutes(HOURS, 1, 60);
  assert.deepEqual(slots, [540, 600, 660, 720, 780, 840, 900, 960]); // 09:00..16:00 hourly
});

test("a slot that wouldn't fully fit before closing time is excluded", () => {
  const slots = generateDaySlotMinutes({ "1": { open: "09:00", close: "09:50" } }, 1, 60);
  assert.deepEqual(slots, []);
});

test("a closed day (null) produces no slots", () => {
  assert.deepEqual(generateDaySlotMinutes(HOURS, 2, 60), []);
});

test("a day missing from the schedule entirely is treated as closed", () => {
  assert.deepEqual(generateDaySlotMinutes(HOURS, 5, 60), []);
});

test("malformed open/close strings produce no slots rather than throwing", () => {
  assert.deepEqual(generateDaySlotMinutes({ "1": { open: "bad", close: "17:00" } }, 1, 60), []);
});

test("generateAvailableSlots excludes a slot already taken by another order", () => {
  const date = new Date(Date.UTC(2026, 10, 2)); // a Monday
  const now = new Date(Date.UTC(2026, 10, 1));
  const taken = [new Date(Date.UTC(2026, 10, 2, 9, 0))];
  const slots = generateAvailableSlots(date, HOURS, 60, taken, now);
  assert.equal(slots.some((s) => s.getTime() === taken[0].getTime()), false);
  assert.equal(slots.length, 7); // 8 total slots minus the 1 taken
});

test("generateAvailableSlots excludes slots already in the past for 'today'", () => {
  const date = new Date(Date.UTC(2026, 10, 2));
  const now = new Date(Date.UTC(2026, 10, 2, 12, 30)); // already past noon
  const slots = generateAvailableSlots(date, HOURS, 60, [], now);
  assert.ok(slots.every((s) => s.getTime() > now.getTime()));
  assert.equal(slots.length, 4); // 13:00, 14:00, 15:00, 16:00
});

test("isSlotOpen accepts an exact grid-aligned slot start", () => {
  assert.equal(isSlotOpen(new Date(Date.UTC(2026, 10, 2, 9, 0, 0)), HOURS, 60), true); // a Monday
});

test("isSlotOpen rejects a time that doesn't align to the grid (e.g. 09:30 on a 60-min grid)", () => {
  assert.equal(isSlotOpen(new Date(Date.UTC(2026, 10, 2, 9, 30, 0)), HOURS, 60), false);
});

test("isSlotOpen rejects a slot on a closed day", () => {
  assert.equal(isSlotOpen(new Date(Date.UTC(2026, 10, 3, 9, 0, 0)), HOURS, 60), false); // Tuesday
});

test("isSlotOpen rejects a non-zero seconds/ms value (a client trying to sneak in an off-grid time)", () => {
  assert.equal(isSlotOpen(new Date(Date.UTC(2026, 10, 2, 9, 0, 30)), HOURS, 60), false);
});

test("isSlotOpen rejects a slot that has already passed, given an explicit 'now'", () => {
  const slot = new Date(Date.UTC(2026, 10, 2, 9, 0, 0)); // a Monday 09:00
  const laterNow = new Date(Date.UTC(2026, 10, 2, 9, 0, 1)); // one second after the slot
  assert.equal(isSlotOpen(slot, HOURS, 60, laterNow), false);
});

test("isSlotOpen accepts a slot that's still in the future relative to 'now'", () => {
  const slot = new Date(Date.UTC(2026, 10, 2, 9, 0, 0));
  const earlierNow = new Date(Date.UTC(2026, 10, 1, 0, 0, 0));
  assert.equal(isSlotOpen(slot, HOURS, 60, earlierNow), true);
});
