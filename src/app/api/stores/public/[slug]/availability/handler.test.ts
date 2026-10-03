import test from "node:test";
import assert from "node:assert/strict";
import { handleGetAvailability, type AvailabilityDb } from "./handler";

const STORE = {
  id: "store-1",
  type: "booking",
  bookingSlotMinutes: 60,
  bookingWorkingHours: { "1": { open: "09:00", close: "12:00" } }, // Monday only, 3 slots
};

function req(query: string) {
  return new Request(`http://localhost/api/stores/public/test-store/availability${query}`);
}

function makeFakeDb(opts: { store?: typeof STORE | null; takenStartTimes?: Date[] } = {}) {
  const store = opts.store !== undefined ? opts.store : STORE;
  const db: AvailabilityDb = {
    store: { findUnique: async () => store },
    order: { findMany: async () => (opts.takenStartTimes ?? []).map((scheduledStartAt) => ({ scheduledStartAt })) },
  };
  return { db };
}

test("rejects a missing/malformed date with 400", async () => {
  const { db } = makeFakeDb();
  const res1 = await handleGetAvailability(db, req(""), "test-store");
  assert.equal(res1.status, 400);
  const res2 = await handleGetAvailability(db, req("?date=not-a-date"), "test-store");
  assert.equal(res2.status, 400);
});

test("returns 404 when the store doesn't exist", async () => {
  const { db } = makeFakeDb({ store: null });
  const res = await handleGetAvailability(db, req("?date=2026-11-02"), "test-store");
  assert.equal(res.status, 404);
});

test("rejects a non-booking store with 400", async () => {
  const { db } = makeFakeDb({ store: { ...STORE, type: "physical" } });
  const res = await handleGetAvailability(db, req("?date=2026-11-02"), "test-store");
  assert.equal(res.status, 400);
});

test("returns every open slot for a working day with nothing booked yet", async () => {
  const { db } = makeFakeDb();
  const res = await handleGetAvailability(db, req("?date=2026-11-02"), "test-store"); // a Monday
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.slots, ["2026-11-02T09:00:00.000Z", "2026-11-02T10:00:00.000Z", "2026-11-02T11:00:00.000Z"]);
});

test("excludes a slot that's already booked", async () => {
  const { db } = makeFakeDb({ takenStartTimes: [new Date("2026-11-02T10:00:00.000Z")] });
  const res = await handleGetAvailability(db, req("?date=2026-11-02"), "test-store");
  const body = await res.json();
  assert.deepEqual(body.slots, ["2026-11-02T09:00:00.000Z", "2026-11-02T11:00:00.000Z"]);
});

test("a closed day returns an empty slot list, not an error", async () => {
  const { db } = makeFakeDb();
  const res = await handleGetAvailability(db, req("?date=2026-11-03"), "test-store"); // Tuesday, not in working hours
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.slots, []);
});
