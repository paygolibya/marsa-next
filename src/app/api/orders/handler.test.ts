import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { handleCreateOrder, type OrdersDb, type OrdersDeps } from "./handler";

process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
process.env.MOAMALAT_SECRET_KEY = crypto.randomBytes(16).toString("hex");

const STORE: { id: string; slug: string; courier: string; codEnabled: boolean; walletProvider: string | null; type: string; merchant: { phone: string } & Record<string, unknown> } = {
  id: "store-1",
  slug: "test-store",
  courier: "vanex",
  codEnabled: true,
  walletProvider: "anis",
  type: "physical",
  merchant: { phone: "0900000000", subscriptionTier: "advanced" },
};

const PRODUCT = { id: "p1", name: "Test Product", priceCents: 5000, stockQty: 10, trackInventory: true };

function req(body: unknown) {
  return new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    storeSlug: "test-store",
    items: [{ productId: "p1", quantity: 2 }],
    buyer: { name: "Buyer", phone: "0911111111", city: "Tripoli", address: "Some street", email: "" },
    paymentMethod: "cod",
    ...overrides,
  };
}

function makeFakeDeps(
  opts: {
    store?: typeof STORE | null;
    product?: typeof PRODUCT | null;
    coupon?: Record<string, unknown> | null;
    // Simulates losing a concurrent race at the atomic decrement/increment
    // step (real Postgres would return count: 0 here when another
    // transaction already consumed the stock/coupon use first).
    productUpdateManyCount?: number;
    couponUpdateManyCount?: number;
  } = {}
) {
  const store = opts.store !== undefined ? opts.store : STORE;
  const product = opts.product !== undefined ? opts.product : PRODUCT;
  const calls: { orderCreate?: Any; orderUpdate?: Any; productUpdateMany?: Any[]; couponUpdateMany?: Any; shipment?: Any; email?: Any; sms?: Any } = {
    productUpdateMany: [],
  };
  let createdOrderId = "order-1";

  const db: OrdersDb = {
    store: { findUnique: async () => store },
    vanexArea: { findUnique: async () => null },
    order: {
      update: async (args) => {
        calls.orderUpdate = args;
        return {};
      },
    },
    $transaction: async (fn: Any) => {
      const tx = {
        product: {
          findFirst: async () => product,
          updateMany: async (args: Any) => {
            calls.productUpdateMany!.push(args);
            return { count: opts.productUpdateManyCount ?? 1 };
          },
        },
        productVariant: { findFirst: async () => null, updateMany: async () => ({ count: 1 }) },
        coupon: {
          findUnique: async () => opts.coupon ?? null,
          updateMany: async (args: Any) => {
            calls.couponUpdateMany = args;
            return { count: opts.couponUpdateManyCount ?? 1 };
          },
        },
        order: {
          create: async (args: Any) => {
            calls.orderCreate = args;
            return {
              id: createdOrderId,
              buyerName: args.data.buyerName,
              buyerEmail: args.data.buyerEmail,
              totalCents: args.data.totalCents,
              discountCents: args.data.discountCents,
            };
          },
        },
      };
      return fn(tx);
    },
  };

  const deps: OrdersDeps = {
    db,
    createShipment: async (courier, order) => {
      calls.shipment = { courier, order };
      return { trackingId: "TRK-TEST-1", raw: {} };
    },
    sendOrderConfirmationEmail: async (order) => {
      calls.email = order;
    },
    sendNewOrderSms: async (phone, orderId, buyerName) => {
      calls.sms = { phone, orderId, buyerName };
    },
  };

  return { deps, calls };
}

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

test("rejects a malformed body with 400 before touching the database at all", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleCreateOrder(deps, req({ storeSlug: "test-store" })); // missing items/buyer/paymentMethod
  assert.equal(res.status, 400);
});

test("returns 404 when the store doesn't exist", async () => {
  const { deps } = makeFakeDeps({ store: null });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 404);
});

test("rejects wallet payment when the store has no wallet provider configured", async () => {
  const { deps } = makeFakeDeps({ store: { ...STORE, walletProvider: null } });
  const res = await handleCreateOrder(deps, req(baseBody({ paymentMethod: "wallet" })));
  assert.equal(res.status, 400);
});

test("rejects COD when the store doesn't accept it", async () => {
  const { deps } = makeFakeDeps({ store: { ...STORE, codEnabled: false } });
  const res = await handleCreateOrder(deps, req(baseBody({ paymentMethod: "cod" })));
  assert.equal(res.status, 400);
});

test("returns 400 when an item's product doesn't exist in this store", async () => {
  const { deps } = makeFakeDeps({ product: null });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 400);
});

test("returns 409 (not 400/500) when stock is insufficient — a real conflict, not a client error", async () => {
  const { deps } = makeFakeDeps({ product: { ...PRODUCT, stockQty: 1 } }); // ordering quantity 2
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 409);
});

test("a product with trackInventory=false is never stock-checked or stock-updated", async () => {
  const { deps, calls } = makeFakeDeps({ product: { ...PRODUCT, trackInventory: false, stockQty: 0 } });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 201);
  assert.deepEqual(calls.productUpdateMany, []);
});

test("COD order: total is computed server-side (price × quantity + shipping), never trusting a client-sent total", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateOrder(deps, req(baseBody({ items: [{ productId: "p1", quantity: 2 }] })));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.totalCents, 10000); // 5000 * 2, no shipping (no vanexAreaId), no discount
  assert.equal(calls.orderCreate.data.productSubtotalCents, 10000);
  assert.equal(calls.orderCreate.data.totalCents, 10000);
});

test("COD order: stock is decremented atomically (guarded by gte quantity), and hits zero flips active to false", async () => {
  const { deps, calls } = makeFakeDeps({ product: { ...PRODUCT, stockQty: 2 } });
  await handleCreateOrder(deps, req(baseBody({ items: [{ productId: "p1", quantity: 2 }] })));
  const [decrementCall, deactivateCall] = calls.productUpdateMany!;
  assert.equal(decrementCall.where.stockQty.gte, 2);
  assert.deepEqual(decrementCall.data.stockQty, { decrement: 2 });
  assert.equal(deactivateCall.where.stockQty.lte, 0);
  assert.equal(deactivateCall.data.active, false);
});

test("stock race: the check above passed, but a concurrent order already took the last unit — the atomic decrement itself catches it with a real 409, not overselling", async () => {
  const { deps } = makeFakeDeps({ product: { ...PRODUCT, stockQty: 2 }, productUpdateManyCount: 0 });
  const res = await handleCreateOrder(deps, req(baseBody({ items: [{ productId: "p1", quantity: 2 }] })));
  assert.equal(res.status, 409);
});

test("coupon race: usageCount looked valid when read, but a concurrent order already used up the last slot — the atomic increment catches it", async () => {
  const { deps, calls } = makeFakeDeps({
    coupon: {
      id: "coupon-1",
      code: "SAVE10",
      active: true,
      discountType: "percent",
      discountValue: 10,
      minOrderCents: null,
      maxUsage: 5,
      usageCount: 4,
      expiresAt: null,
    },
    couponUpdateManyCount: 0,
  });
  const res = await handleCreateOrder(deps, req(baseBody({ couponCode: "SAVE10" })));
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.ok(body.error);
  assert.equal(calls.orderCreate, undefined);
});

test("COD order: dispatches a real shipment, updates the order with the tracking id, and notifies buyer+merchant", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateOrder(deps, req(baseBody()));
  const body = await res.json();
  assert.equal(body.trackingId, "TRK-TEST-1");
  assert.equal(calls.shipment.courier, "vanex");
  assert.equal(calls.orderUpdate.data.courierTrackingId, "TRK-TEST-1");
  assert.equal(calls.orderUpdate.data.status, "confirmed");
  assert.ok(calls.email);
  assert.ok(calls.sms);
});

// The actual feature this covers: a real merchant selling digital goods
// (Snapchat filters) has no physical delivery at all — no courier to
// dispatch to, so the order confirms immediately instead of waiting on
// a shipment step that would never happen.
test("COD order on a digital store: confirms immediately without dispatching a shipment, still notifies buyer+merchant", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "digital" } });
  const res = await handleCreateOrder(deps, req(baseBody()));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.trackingId, undefined);
  assert.equal(body.courier, undefined);
  assert.equal(calls.shipment, undefined, "must never call createShipment for a digital store");
  assert.equal(calls.orderUpdate.data.status, "confirmed");
  assert.equal(calls.orderUpdate.data.courierTrackingId, undefined);
  assert.ok(calls.email);
  assert.ok(calls.sms);
});

test("wallet order: returns a signed LightBox config and 201, WITHOUT dispatching a shipment or sending notifications yet", async () => {
  // Wallet orders only get shipped/notified once payment actually confirms
  // (see moamalat-order.ts's finalizeWalletOrder) — this route must not
  // jump the gun.
  const { deps, calls } = makeFakeDeps();
  const res = await handleCreateOrder(deps, req(baseBody({ paymentMethod: "wallet" })));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.moamalat.SecureHash);
  assert.equal(body.paymentStatus, "pending");
  assert.equal(calls.shipment, undefined);
  assert.equal(calls.email, undefined);
  assert.equal(calls.sms, undefined);
});

test("an invalid coupon code returns 400 and never creates the order", async () => {
  const { deps, calls } = makeFakeDeps({ coupon: null });
  const res = await handleCreateOrder(deps, req(baseBody({ couponCode: "NOPE" })));
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("a valid coupon discounts the total server-side and its usage count is incremented", async () => {
  const { deps, calls } = makeFakeDeps({
    coupon: {
      id: "coupon-1",
      code: "SAVE10",
      active: true,
      discountType: "percent",
      discountValue: 10,
      minOrderCents: null,
      maxUsage: null,
      usageCount: 3,
      expiresAt: null,
    },
  });
  const res = await handleCreateOrder(deps, req(baseBody({ couponCode: "save10" }))); // lowercase on purpose — must normalize
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.discountCents, 1000); // 10% of 10000
  assert.equal(body.totalCents, 9000);
  assert.equal(calls.couponUpdateMany.where.id, "coupon-1");
  assert.equal(calls.couponUpdateMany.where.usageCount, undefined); // maxUsage null here — no cap to race against, no guard needed
  assert.deepEqual(calls.couponUpdateMany.data.usageCount, { increment: 1 });
});
