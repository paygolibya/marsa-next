import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListNotifications, type ListNotificationsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/notifications", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/notifications");
}

const NOTIFICATION = { id: "n1", type: "new_order", title: "لديك طلب جديد", body: "طلب رقم order-1", link: "/dashboard/orders", read: false, createdAt: new Date() };

function makeFakeDb(opts: { notifications?: typeof NOTIFICATION[]; unreadCount?: number } = {}) {
  const calls: { findManyWhere?: unknown; countWhere?: unknown } = {};
  const db: ListNotificationsDb = {
    notification: {
      findMany: async (args) => {
        calls.findManyWhere = args.where;
        return opts.notifications ?? [];
      },
      count: async (args) => {
        calls.countWhere = args.where;
        return opts.unreadCount ?? 0;
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListNotifications(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("scopes both queries to the authenticated merchant only", async () => {
  const { db, calls } = makeFakeDb();
  await handleListNotifications(db, req("merchant-77"));
  assert.deepEqual(calls.findManyWhere, { merchantId: "merchant-77" });
  assert.deepEqual(calls.countWhere, { merchantId: "merchant-77", read: false });
});

test("returns the notification list and unread count", async () => {
  const { db } = makeFakeDb({ notifications: [NOTIFICATION], unreadCount: 3 });
  const res = await handleListNotifications(db, req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.notifications.length, 1);
  assert.equal(body.unreadCount, 3);
});
