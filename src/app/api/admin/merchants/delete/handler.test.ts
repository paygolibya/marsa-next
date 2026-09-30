import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleDeleteMerchant, type DeleteMerchantDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/delete", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/delete", { method: "DELETE", body: JSON.stringify(body) });
}

function makeFakeDb(storeIds: string[]) {
  const callOrder: string[] = [];
  const calls: Record<string, unknown> = {};
  const db: DeleteMerchantDb = {
    store: {
      findMany: async (args) => {
        callOrder.push("store.findMany");
        calls.storeFindManyWhere = args.where;
        return storeIds.map((id) => ({ id }));
      },
      deleteMany: async (args) => {
        callOrder.push("store.deleteMany");
        calls.storeDeleteManyWhere = args.where;
        return {};
      },
    },
    productReview: {
      deleteMany: async (args) => {
        callOrder.push("productReview.deleteMany");
        calls.productReviewWhere = args.where;
        return {};
      },
    },
    orderItem: {
      deleteMany: async (args) => {
        callOrder.push("orderItem.deleteMany");
        calls.orderItemWhere = args.where;
        return {};
      },
    },
    order: {
      deleteMany: async (args) => {
        callOrder.push("order.deleteMany");
        calls.orderWhere = args.where;
        return {};
      },
    },
    product: {
      deleteMany: async (args) => {
        callOrder.push("product.deleteMany");
        calls.productWhere = args.where;
        return {};
      },
    },
    coupon: {
      deleteMany: async (args) => {
        callOrder.push("coupon.deleteMany");
        calls.couponWhere = args.where;
        return {};
      },
    },
    payment: {
      deleteMany: async (args) => {
        callOrder.push("payment.deleteMany");
        calls.paymentWhere = args.where;
        return {};
      },
    },
    bugReport: {
      deleteMany: async (args) => {
        callOrder.push("bugReport.deleteMany");
        calls.bugReportWhere = args.where;
        return {};
      },
    },
    impersonationSession: {
      deleteMany: async (args) => {
        callOrder.push("impersonationSession.deleteMany");
        calls.impersonationSessionWhere = args.where;
        return {};
      },
    },
    merchant: {
      delete: async (args) => {
        callOrder.push("merchant.delete");
        calls.merchantDeleteWhere = args.where;
        return {};
      },
    },
  };
  return { db, calls, callOrder };
}

test("rejects a non-admin/unauthenticated request with 403, before touching the database", async () => {
  const { db, callOrder } = makeFakeDb(["store-1"]);
  const res = await handleDeleteMerchant(db, noTokenReq({ merchantId: "m1" }));
  assert.equal(res.status, 403);
  assert.equal(callOrder.length, 0);
});

test("deletes in the exact order dependencies require: reviews and order items before orders/products, everything before the merchant row itself", async () => {
  const { db, callOrder } = makeFakeDb(["store-1", "store-2"]);
  const res = await handleDeleteMerchant(db, adminReq({ merchantId: "m1" }));
  assert.equal(res.status, 200);
  assert.deepEqual(callOrder, [
    "store.findMany",
    "productReview.deleteMany",
    "orderItem.deleteMany",
    "order.deleteMany",
    "product.deleteMany",
    "coupon.deleteMany",
    "store.deleteMany",
    "payment.deleteMany",
    "bugReport.deleteMany",
    "impersonationSession.deleteMany",
    "merchant.delete",
  ]);
});

// The actual bug found while auditing this route: bugReport.deleteMany
// didn't exist at all, so deleting a merchant with any open bug report
// hit an unhandled foreign-key violation on BugReport.merchantId (no
// onDelete: Cascade in the schema) and 500'd, leaving a half-deleted
// merchant. This is the regression test.
test("deletes any bug reports scoped to the target merchant before deleting the merchant row", async () => {
  const { db, calls } = makeFakeDb(["store-1"]);
  const res = await handleDeleteMerchant(db, adminReq({ merchantId: "target-merchant" }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.bugReportWhere, { merchantId: "target-merchant" });
});

// Same class of gap as bugReport above, closed proactively for the new
// ImpersonationSession model (also a bare FK to Merchant, no cascade) —
// see schema.prisma's own comment on that model for why it's not a
// DB-level cascade instead.
test("deletes any impersonation-session log rows scoped to the target merchant before deleting the merchant row", async () => {
  const { db, calls } = makeFakeDb(["store-1"]);
  const res = await handleDeleteMerchant(db, adminReq({ merchantId: "target-merchant" }));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.impersonationSessionWhere, { merchantId: "target-merchant" });
});

test("scopes every deletion to the target merchant's own stores/id, never a different merchant's data", async () => {
  const { db, calls } = makeFakeDb(["store-a", "store-b"]);
  await handleDeleteMerchant(db, adminReq({ merchantId: "target-merchant" }));
  assert.deepEqual(calls.storeFindManyWhere, { merchantId: "target-merchant" });
  assert.deepEqual(calls.orderWhere, { storeId: { in: ["store-a", "store-b"] } });
  assert.deepEqual(calls.productWhere, { storeId: { in: ["store-a", "store-b"] } });
  assert.deepEqual(calls.couponWhere, { storeId: { in: ["store-a", "store-b"] } });
  assert.deepEqual(calls.storeDeleteManyWhere, { merchantId: "target-merchant" });
  assert.deepEqual(calls.paymentWhere, { merchantId: "target-merchant" });
  assert.deepEqual(calls.bugReportWhere, { merchantId: "target-merchant" });
  assert.deepEqual(calls.impersonationSessionWhere, { merchantId: "target-merchant" });
  assert.deepEqual((calls.merchantDeleteWhere as any).id, "target-merchant");
});

test("a merchant with no stores still deletes cleanly (empty storeIds, not an error)", async () => {
  const { db, callOrder } = makeFakeDb([]);
  const res = await handleDeleteMerchant(db, adminReq({ merchantId: "m1" }));
  assert.equal(res.status, 200);
  assert.ok(callOrder.includes("merchant.delete"));
});

test("if a step throws partway through, returns 500 rather than reporting success on a half-deleted merchant", async () => {
  const { db } = makeFakeDb(["store-1"]);
  db.order.deleteMany = async () => {
    throw new Error("db down");
  };
  const res = await handleDeleteMerchant(db, adminReq({ merchantId: "m1" }));
  assert.equal(res.status, 500);
});
