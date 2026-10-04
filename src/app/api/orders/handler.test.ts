import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { handleCreateOrder, type OrdersDb, type OrdersDeps } from "./handler";

process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
process.env.MOAMALAT_SECRET_KEY = crypto.randomBytes(16).toString("hex");

const STORE: {
  id: string;
  slug: string;
  courier: string;
  codEnabled: boolean;
  walletProvider: string | null;
  type: string;
  bookingSlotMinutes: number | null;
  bookingWorkingHours: unknown;
  merchant: { phone: string } & Record<string, unknown>;
} = {
  id: "store-1",
  slug: "test-store",
  courier: "vanex",
  codEnabled: true,
  walletProvider: "anis",
  type: "physical",
  bookingSlotMinutes: null,
  bookingWorkingHours: null,
  merchant: { phone: "0900000000", subscriptionTier: "advanced" },
};

const PRODUCT = { id: "p1", name: "Test Product", priceCents: 5000, stockQty: 10, trackInventory: true };

const BUNDLE = {
  id: "bundle-1",
  name: "Test Bundle",
  priceCents: 8000,
  items: [
    { productId: "comp-1", quantity: 2, product: { name: "Component A", stockQty: 10, trackInventory: true } },
    { productId: "comp-2", quantity: 1, product: { name: "Component B", stockQty: 10, trackInventory: true } },
  ],
};

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
    bundle?: typeof BUNDLE | null;
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
  const bundle = opts.bundle !== undefined ? opts.bundle : null;
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
        bundle: { findFirst: async () => bundle },
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

test("a showcase store rejects order creation outright — no checkout at all, even via a direct call bypassing the UI", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "showcase" } });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
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

test("rental order: total is daily rate × days × quantity (never trusting a client-sent total), confirms immediately with no shipment", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "rental" }, product: { ...PRODUCT, priceCents: 5000 } });
  const res = await handleCreateOrder(
    deps,
    req(
      baseBody({
        items: [{ productId: "p1", quantity: 2 }],
        scheduledStartAt: "2026-11-01T00:00:00.000Z",
        scheduledEndAt: "2026-11-04T00:00:00.000Z", // 3 days
      })
    )
  );
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.totalCents, 5000 * 3 * 2); // rate * days * qty
  assert.equal(calls.shipment, undefined, "must never call createShipment for a rental store");
  assert.equal(calls.orderUpdate.data.status, "confirmed");
  assert.equal(calls.orderCreate.data.scheduledStartAt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(calls.orderCreate.data.scheduledEndAt.toISOString(), "2026-11-04T00:00:00.000Z");
});

test("rental order: a same-day or inverted range is rejected with 400 before touching the database", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "rental" } });
  const res = await handleCreateOrder(
    deps,
    req(baseBody({ scheduledStartAt: "2026-11-04T00:00:00.000Z", scheduledEndAt: "2026-11-01T00:00:00.000Z" }))
  );
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("rental order: missing dates are rejected with 400", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "rental" } });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("rental order: a pickup date already in the past is rejected with 400", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "rental" } });
  const res = await handleCreateOrder(
    deps,
    req(baseBody({ scheduledStartAt: "2020-01-01T00:00:00.000Z", scheduledEndAt: "2020-01-03T00:00:00.000Z" }))
  );
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("rental order: a same-day pickup (today) is accepted, not rejected as 'in the past'", async () => {
  const { deps, calls } = makeFakeDeps({ store: { ...STORE, type: "rental" } });
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart.getTime() + 86_400_000);
  const res = await handleCreateOrder(
    deps,
    req(baseBody({ scheduledStartAt: todayStart.toISOString(), scheduledEndAt: tomorrow.toISOString() }))
  );
  assert.equal(res.status, 201);
  assert.ok(calls.orderCreate);
});

const BOOKING_STORE = {
  ...STORE,
  type: "booking",
  bookingSlotMinutes: 60,
  bookingWorkingHours: { "1": { open: "09:00", close: "17:00" } }, // Monday only
};

test("booking order: an open, grid-aligned slot is accepted, confirms immediately with the server-recomputed end time", async () => {
  const { deps, calls } = makeFakeDeps({ store: BOOKING_STORE });
  const res = await handleCreateOrder(deps, req(baseBody({ scheduledStartAt: "2026-11-02T09:00:00.000Z" }))); // a Monday
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(calls.shipment, undefined, "must never call createShipment for a booking store");
  assert.equal(calls.orderUpdate.data.status, "confirmed");
  assert.equal(calls.orderCreate.data.scheduledKind, "booking");
  assert.equal(calls.orderCreate.data.scheduledStartAt.toISOString(), "2026-11-02T09:00:00.000Z");
  // Recomputed server-side from bookingSlotMinutes, never from a client value.
  assert.equal(calls.orderCreate.data.scheduledEndAt.toISOString(), "2026-11-02T10:00:00.000Z");
  assert.equal(body.totalCents, 10000); // unaffected by booking — still plain price × quantity
});

test("booking order: an off-grid time (not a real slot start) is rejected with 400", async () => {
  const { deps, calls } = makeFakeDeps({ store: BOOKING_STORE });
  const res = await handleCreateOrder(deps, req(baseBody({ scheduledStartAt: "2026-11-02T09:30:00.000Z" })));
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("booking order: a slot outside working hours (a closed day) is rejected with 400", async () => {
  const { deps, calls } = makeFakeDeps({ store: BOOKING_STORE });
  const res = await handleCreateOrder(deps, req(baseBody({ scheduledStartAt: "2026-11-03T09:00:00.000Z" }))); // Tuesday: closed
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("booking order: no slot at all is rejected with 400", async () => {
  const { deps, calls } = makeFakeDeps({ store: BOOKING_STORE });
  const res = await handleCreateOrder(deps, req(baseBody()));
  assert.equal(res.status, 400);
  assert.equal(calls.orderCreate, undefined);
});

test("booking order: a concurrent order already took this exact slot — the DB's own unique-violation maps to a real 409, not a 500", async () => {
  const { deps } = makeFakeDeps({ store: BOOKING_STORE });
  deps.db.$transaction = async () => {
    throw { code: "P2002" };
  };
  const res = await handleCreateOrder(deps, req(baseBody({ scheduledStartAt: "2026-11-02T09:00:00.000Z" })));
  assert.equal(res.status, 409);
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

test("returns 400 when a bundle doesn't exist in this store", async () => {
  const { deps } = makeFakeDeps({ bundle: null });
  const res = await handleCreateOrder(deps, req(baseBody({ items: [{ bundleId: "bundle-1", quantity: 1 }] })));
  assert.equal(res.status, 400);
});

test("a bundle order: one OrderItem row at the bundle's own fixed price (productId null, bundleId set), never the sum of component prices", async () => {
  const { deps, calls } = makeFakeDeps({ bundle: BUNDLE });
  const res = await handleCreateOrder(deps, req(baseBody({ items: [{ bundleId: "bundle-1", quantity: 2 }] })));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.totalCents, 8000 * 2); // bundle price × quantity, not component prices
  const created = calls.orderCreate.data.items.create[0];
  assert.equal(created.productId, null);
  assert.equal(created.bundleId, "bundle-1");
  assert.equal(created.bundleName, "Test Bundle");
  assert.equal(created.unitPriceCents, 8000);
  assert.equal(created.quantity, 2);
  assert.deepEqual(created.bundleItemsSnapshot, [
    { productName: "Component A", quantity: 2 },
    { productName: "Component B", quantity: 1 },
  ]);
});

test("a bundle order: decrements stock for every component, scaled by (component quantity × bundles bought)", async () => {
  const { deps, calls } = makeFakeDeps({ bundle: BUNDLE });
  await handleCreateOrder(deps, req(baseBody({ items: [{ bundleId: "bundle-1", quantity: 2 }] })));
  const decrementCalls = calls.productUpdateMany!.filter((c: Any) => "decrement" in (c.data.stockQty ?? {}));
  assert.equal(decrementCalls.length, 2);
  assert.equal(decrementCalls[0].where.id, "comp-1");
  assert.equal(decrementCalls[0].data.stockQty.decrement, 4); // 2 per bundle × 2 bundles
  assert.equal(decrementCalls[1].where.id, "comp-2");
  assert.equal(decrementCalls[1].data.stockQty.decrement, 2); // 1 per bundle × 2 bundles
});

test("a bundle order: insufficient stock on one component returns 409 without creating the order", async () => {
  const { deps, calls } = makeFakeDeps({
    bundle: { ...BUNDLE, items: [{ productId: "comp-1", quantity: 5, product: { name: "Component A", stockQty: 3, trackInventory: true } }] },
  });
  const res = await handleCreateOrder(deps, req(baseBody({ items: [{ bundleId: "bundle-1", quantity: 1 }] })));
  assert.equal(res.status, 409);
  assert.equal(calls.orderCreate, undefined);
});

test("a bundle order mixed with a plain product line: both resolve into their own OrderItem rows and total correctly", async () => {
  const { deps, calls } = makeFakeDeps({ bundle: BUNDLE, product: PRODUCT });
  const res = await handleCreateOrder(
    deps,
    req(baseBody({ items: [{ bundleId: "bundle-1", quantity: 1 }, { productId: "p1", quantity: 1 }] }))
  );
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.totalCents, 8000 + 5000);
  assert.equal(calls.orderCreate.data.items.create.length, 2);
});
