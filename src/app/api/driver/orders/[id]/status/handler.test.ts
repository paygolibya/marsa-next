import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateDriverStatus, type DriverStatusDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "admin-1") {
  return new Request("http://localhost/api/driver/orders/o1/status", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

const NOW = new Date("2026-10-17T15:00:00Z");

function makeDeps(order: Record<string, unknown> | null) {
  const calls: { update?: { where: { id: string }; data: Record<string, unknown> }; emails: string[]; sms: string[]; commission: string[] } = {
    emails: [],
    sms: [],
    commission: [],
  };
  const base = {
    id: "o1",
    buyerName: "Buyer",
    buyerEmail: "b@example.com",
    buyerPhone: "0911111111",
    totalCents: 11500,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "confirmed",
    deliveryServiceLevel: "SAME_DAY",
    deliveryStatus: "PENDING",
  };
  const deps: DriverStatusDeps = {
    db: {
      order: {
        findUnique: async () => (order === null ? null : ({ ...base, ...order } as typeof base)),
        update: async (args) => {
          calls.update = args;
          return {};
        },
      },
    },
    isDriver: async (id) => id === "admin-1",
    sendOrderStatusEmail: async (_o, status) => {
      calls.emails.push(status);
    },
    sendShipmentStatusSms: async (_p, status) => {
      calls.sms.push(status);
    },
    calculateCommissionForOrder: async (id) => {
      calls.commission.push(id);
      return { created: false };
    },
    now: () => NOW,
  };
  return { deps, calls };
}

test("non-drivers get 403 and nothing is written", async () => {
  const { deps, calls } = makeDeps({});
  const res = await handleUpdateDriverStatus(deps, req({ status: "PICKED_UP" }, "someone-else"), "o1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("picked up: records the driver and the Vanex-equivalent courier status, notifies the buyer, leaves order.status alone", async () => {
  const { deps, calls } = makeDeps({});
  const res = await handleUpdateDriverStatus(deps, req({ status: "PICKED_UP" }), "o1");
  assert.equal(res.status, 200);
  assert.equal(calls.update!.data.deliveryStatus, "PICKED_UP");
  assert.equal(calls.update!.data.deliveryCourierId, "admin-1");
  assert.equal(calls.update!.data.courierStatus, "accepted");
  assert.equal(calls.update!.data.status, undefined);
  assert.deepEqual(calls.sms, ["accepted"]);
  assert.deepEqual(calls.commission, []);
});

test("delivered: requires the cash amount on an unpaid COD order", async () => {
  const { deps, calls } = makeDeps({});
  const res = await handleUpdateDriverStatus(deps, req({ status: "DELIVERED" }), "o1");
  assert.equal(res.status, 400);
  assert.equal(calls.update, undefined);
});

test("delivered: records cash collected, maps to order.status delivered, notifies and runs commission like the Vanex webhook", async () => {
  const { deps, calls } = makeDeps({});
  const res = await handleUpdateDriverStatus(deps, req({ status: "DELIVERED", cashCollectedCents: 11500 }), "o1");
  assert.equal(res.status, 200);
  assert.equal(calls.update!.data.status, "delivered");
  assert.equal(calls.update!.data.deliveryStatus, "DELIVERED");
  assert.equal(calls.update!.data.cashCollectedCents, 11500);
  assert.equal((calls.update!.data.cashCollectedAt as Date).toISOString(), NOW.toISOString());
  assert.equal(calls.update!.data.courierStatus, "delivered");
  assert.deepEqual(calls.emails, ["delivered"]);
  assert.deepEqual(calls.commission, ["o1"]);
});

test("delivered: a paid wallet order records zero cash without asking for it", async () => {
  const { deps, calls } = makeDeps({ paymentMethod: "wallet", paymentStatus: "paid" });
  const res = await handleUpdateDriverStatus(deps, req({ status: "DELIVERED" }), "o1");
  assert.equal(res.status, 200);
  assert.equal(calls.update!.data.cashCollectedCents, 0);
});

test("failed: maps to failed_delivery without changing order.status", async () => {
  const { deps, calls } = makeDeps({});
  await handleUpdateDriverStatus(deps, req({ status: "FAILED" }), "o1");
  assert.equal(calls.update!.data.courierStatus, "failed_delivery");
  assert.equal(calls.update!.data.status, undefined);
});

test("rejects unknown statuses, Vanex (non-own-team) orders, cancelled orders, and re-delivering", async () => {
  assert.equal((await handleUpdateDriverStatus(makeDeps({}).deps, req({ status: "PENDING" }), "o1")).status, 400);
  assert.equal((await handleUpdateDriverStatus(makeDeps({ deliveryServiceLevel: null }).deps, req({ status: "PICKED_UP" }), "o1")).status, 404);
  assert.equal((await handleUpdateDriverStatus(makeDeps(null).deps, req({ status: "PICKED_UP" }), "o1")).status, 404);
  assert.equal((await handleUpdateDriverStatus(makeDeps({ status: "cancelled" }).deps, req({ status: "PICKED_UP" }), "o1")).status, 400);
  assert.equal((await handleUpdateDriverStatus(makeDeps({ deliveryStatus: "DELIVERED" }).deps, req({ status: "FAILED" }), "o1")).status, 409);
});
