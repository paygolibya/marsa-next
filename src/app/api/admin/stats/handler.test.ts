import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleAdminStats, type AdminStatsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/stats", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/admin/stats");
}

function makeFakeDb(opts: { merchants: number; orders: number; sumAmount: number | null; pendingPayments: number }) {
  const db: AdminStatsDb = {
    merchant: { count: async () => opts.merchants },
    order: { count: async () => opts.orders },
    payment: {
      aggregate: async () => ({ _sum: { amount: opts.sumAmount } }),
      count: async () => opts.pendingPayments,
    },
  };
  return db;
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const db = makeFakeDb({ merchants: 0, orders: 0, sumAmount: null, pendingPayments: 0 });
  const res = await handleAdminStats(db, noTokenReq());
  assert.equal(res.status, 403);
});

test("treats no approved payments (null sum) as zero revenue, not an error", async () => {
  const db = makeFakeDb({ merchants: 5, orders: 10, sumAmount: null, pendingPayments: 2 });
  const res = await handleAdminStats(db, adminReq());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.revenue, 0);
});

test("returns the real aggregate numbers", async () => {
  const db = makeFakeDb({ merchants: 12, orders: 340, sumAmount: 55000, pendingPayments: 4 });
  const res = await handleAdminStats(db, adminReq());
  const body = await res.json();
  assert.equal(body.merchants, 12);
  assert.equal(body.orders, 340);
  assert.equal(body.revenue, 55000);
  assert.equal(body.pendingPayments, 4);
});
