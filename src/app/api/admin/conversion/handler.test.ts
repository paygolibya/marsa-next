import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleConversion, type ConversionDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
const req = (id = "admin-1") =>
  new Request("http://localhost/api/admin/conversion", { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: id }, process.env.JWT_SECRET!)}` } });

const NOW = new Date("2026-11-04T08:00:00Z");
const m = (id: string, endInDays: number | null, store: Record<string, unknown> | null, extra: Record<string, unknown> = {}) => ({
  id,
  name: "Merchant " + id,
  phone: "0920000000",
  createdAt: new Date("2026-10-01T00:00:00Z"),
  phoneVerified: true,
  subscriptionStatus: "active",
  subscriptionEndDate: endInDays === null ? null : new Date(NOW.getTime() + endInDays * 86_400_000),
  _count: { payments: 0 },
  stores: store ? [{ slug: "s-" + id, type: "physical", bookingWorkingHours: null, bookingSlotMinutes: null, _count: { products: 2, orders: 0 }, ...store }] : [],
  ...extra,
});

function deps(rows: unknown[], admin = true): ConversionDeps {
  return { db: { merchant: { findMany: async () => rows } }, isAdmin: async () => admin, now: () => NOW };
}

test("non-admins get 403", async () => {
  assert.equal((await handleConversion(deps([], false), req("x"))).status, 403);
});

test("rows carry stage + days left, soonest trial end first, with a follow-up wa.me link", async () => {
  const res = await handleConversion(deps([m("late", 60, {}), m("soon", 5, {}), m("nostore", 20, null)]), req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.rows.map((r: { id: string }) => r.id), ["soon", "nostore", "late"]);
  assert.equal(body.rows[0].stage, "no_orders");
  assert.equal(body.rows[0].daysLeft, 5);
  assert.match(decodeURIComponent(body.rows[0].whatsappUrl), /payment\?period=1m/, "close to the end → payment link");
  assert.equal(body.rows[1].stage, "no_store");
  assert.equal(body.byStage.no_orders, 2);
});
