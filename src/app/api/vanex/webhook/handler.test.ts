import test from "node:test";
import assert from "node:assert/strict";
import { handleVanexWebhook, type VanexWebhookDeps } from "./handler";

process.env.VANEX_WEBHOOK_SECRET = "test-webhook-secret";

function req(body: unknown, key: string | null = "test-webhook-secret") {
  return new Request("http://localhost/api/vanex/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { "x-webhook-key": key } : {}) },
    body: JSON.stringify(body),
  });
}

type Order = { id: string; buyerName: string; buyerEmail: string | null; buyerPhone: string; totalCents: number; courierTrackingId: string | null };

function makeFakeDeps(orders: Order[]) {
  const calls: { updates: { id: string; data: any }[]; emails: any[]; sms: any[]; commissions: string[] } = {
    updates: [],
    emails: [],
    sms: [],
    commissions: [],
  };
  const deps: VanexWebhookDeps = {
    db: {
      order: {
        findMany: async (args) => orders.filter((o) => o.courierTrackingId === args.where.courierTrackingId),
        update: async (args) => {
          calls.updates.push({ id: args.where.id as string, data: args.data });
          return {};
        },
      },
    },
    sendOrderStatusEmail: async (order, status) => {
      calls.emails.push({ orderId: order.id, status });
    },
    sendShipmentStatusSms: async (phone, status, trackingId) => {
      calls.sms.push({ phone, status, trackingId });
    },
    calculateCommissionForOrder: async (orderId) => {
      calls.commissions.push(orderId);
      return { created: true };
    },
  };
  return { deps, calls };
}

test("rejects with 401 when the webhook key is missing or wrong", async () => {
  const { deps } = makeFakeDeps([]);
  const res1 = await handleVanexWebhook(deps, req({ type: "package_delivered" }, null));
  assert.equal(res1.status, 401);
  const res2 = await handleVanexWebhook(deps, req({ type: "package_delivered" }, "wrong-key"));
  assert.equal(res2.status, 401);
});

test("rejects invalid JSON with 400 rather than throwing", async () => {
  const { deps } = makeFakeDeps([]);
  const res = await handleVanexWebhook(
    deps,
    new Request("http://localhost/api/vanex/webhook", {
      method: "POST",
      headers: { "x-webhook-key": "test-webhook-secret" },
      body: "not json",
    })
  );
  assert.equal(res.status, 400);
});

test("'settlement' type is a no-op success, never touches an order", async () => {
  const { deps, calls } = makeFakeDeps([]);
  const res = await handleVanexWebhook(deps, req({ type: "settlement", amount: 1000 }));
  assert.equal(res.status, 200);
  assert.equal(calls.updates.length, 0);
});

test("an unrecognized type returns success without throwing, and touches nothing", async () => {
  const { deps, calls } = makeFakeDeps([]);
  const res = await handleVanexWebhook(deps, req({ type: "something_vanex_added_later", packages: [{ code: "TRK1" }] }));
  assert.equal(res.status, 200);
  assert.equal(calls.updates.length, 0);
});

test("a package with no matching order is skipped, not an error, and the rest of the batch still processes", async () => {
  const { deps, calls } = makeFakeDeps([
    { id: "order-2", buyerName: "Buyer 2", buyerEmail: null, buyerPhone: "0900002", totalCents: 5000, courierTrackingId: "TRK2" },
  ]);
  const res = await handleVanexWebhook(
    deps,
    req({ type: "package_delivered", packages: [{ code: "TRK-UNMATCHED" }, { code: "TRK2" }] })
  );
  assert.equal(res.status, 200);
  assert.equal(calls.updates.length, 1);
  assert.equal(calls.updates[0].id, "order-2");
});

test("package_delivered updates courierStatus AND status='delivered', sends email+sms, and triggers commission calculation", async () => {
  const { deps, calls } = makeFakeDeps([
    { id: "order-1", buyerName: "Buyer 1", buyerEmail: null, buyerPhone: "0900001", totalCents: 10000, courierTrackingId: "TRK1" },
  ]);
  const res = await handleVanexWebhook(deps, req({ type: "package_delivered", packages: [{ code: "TRK1" }] }));
  assert.equal(res.status, 200);

  assert.equal(calls.updates[0].data.courierStatus, "delivered");
  assert.equal(calls.updates[0].data.status, "delivered"); // only set for delivered
  assert.equal(calls.emails[0].status, "delivered");
  assert.equal(calls.sms[0].status, "delivered");
  assert.deepEqual(calls.commissions, ["order-1"]);
});

test("package_accepted updates courierStatus but does NOT set order.status or trigger commission calculation", async () => {
  const { deps, calls } = makeFakeDeps([
    { id: "order-1", buyerName: "Buyer 1", buyerEmail: null, buyerPhone: "0900001", totalCents: 10000, courierTrackingId: "TRK1" },
  ]);
  await handleVanexWebhook(deps, req({ type: "package_accepted", packages: [{ code: "TRK1" }] }));

  assert.equal(calls.updates[0].data.courierStatus, "accepted");
  assert.equal("status" in calls.updates[0].data, false); // must NOT be present at all — only "delivered" sets it
  assert.equal(calls.commissions.length, 0);
});

test("a failed_delivery event carries the non_delivery_reason through as courierNote", async () => {
  const { deps, calls } = makeFakeDeps([
    { id: "order-1", buyerName: "Buyer 1", buyerEmail: null, buyerPhone: "0900001", totalCents: 10000, courierTrackingId: "TRK1" },
  ]);
  await handleVanexWebhook(
    deps,
    req({ type: "package_failed_delivery", packages: [{ code: "TRK1", non_delivery_reason: "buyer not home" }] })
  );
  assert.equal(calls.updates[0].data.courierNote, "buyer not home");
});

test("a commission-calculation failure for one order never fails the webhook response", async () => {
  const { deps, calls } = makeFakeDeps([
    { id: "order-1", buyerName: "Buyer 1", buyerEmail: null, buyerPhone: "0900001", totalCents: 10000, courierTrackingId: "TRK1" },
  ]);
  deps.calculateCommissionForOrder = async () => {
    throw new Error("commission service down");
  };
  const res = await handleVanexWebhook(deps, req({ type: "package_delivered", packages: [{ code: "TRK1" }] }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});
