import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { amountToCollectCents, handleListDriverOrders, type DriverOrdersDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authed(merchantId = "admin-1") {
  return new Request("http://localhost/api/driver/orders", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

const tripoli = (iso: string) => new Date(`${iso}+02:00`);

function row(id: string, createdAt: Date, level: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    createdAt,
    buyerName: "Buyer",
    buyerPhone: "0911111111",
    buyerCity: "طرابلس - بن عاشور",
    buyerAddress: "street",
    totalCents: 11500,
    shippingCents: 1500,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "confirmed",
    deliveryServiceLevel: level,
    deliveryStatus: "PENDING",
    cashCollectedCents: null,
    cashCollectedAt: null,
    store: { name: "Shop", merchant: { phone: "0922222222" } },
    items: [],
    ...extra,
  };
}

function makeDeps(rows: ReturnType<typeof row>[], isDriver = true) {
  const calls: { where?: unknown } = {};
  const deps: DriverOrdersDeps = {
    db: {
      order: {
        findMany: async (args) => {
          calls.where = args.where;
          return rows;
        },
      },
    },
    isDriver: async (id) => isDriver && id === "admin-1",
    now: () => tripoli("2026-10-17T10:00:00"),
  };
  return { deps, calls };
}

test("rejects a caller who isn't an allowed driver/admin with 403", async () => {
  const { deps } = makeDeps([], false);
  const res = await handleListDriverOrders(deps, authed());
  assert.equal(res.status, 403);
  const noToken = await handleListDriverOrders(makeDeps([]).deps, new Request("http://localhost/api/driver/orders"));
  assert.equal(noToken.status, 403);
});

test("lists only own-team orders due today (Tripoli), with promised time and cash to collect", async () => {
  const { deps, calls } = makeDeps([
    row("same-day-today", tripoli("2026-10-17T09:00:00"), "SAME_DAY"),
    row("next-morning-from-yesterday", tripoli("2026-10-16T18:00:00"), "NEXT_MORNING"),
    row("next-morning-placed-today", tripoli("2026-10-17T08:30:00"), "NEXT_MORNING"), // due tomorrow
    row("same-day-yesterday", tripoli("2026-10-16T09:00:00"), "SAME_DAY"), // was due yesterday
  ]);
  const res = await handleListDriverOrders(deps, authed());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.date, "2026-10-17");
  assert.deepEqual(
    body.orders.map((o: { id: string }) => o.id),
    ["same-day-today", "next-morning-from-yesterday"]
  );
  assert.equal(body.orders[0].amountToCollectCents, 11500);
  assert.equal(new Date(body.orders[0].promisedBy).toISOString(), tripoli("2026-10-17T21:00:00").toISOString());
  const where = calls.where as { deliveryServiceLevel: unknown; status: { notIn: string[] } };
  assert.deepEqual(where.deliveryServiceLevel, { not: null }, "only own-team orders");
  assert.ok(where.status.notIn.includes("cancelled"));
});

test("a paid wallet order has nothing to collect; unpaid COD collects the full total", () => {
  assert.equal(amountToCollectCents({ paymentMethod: "wallet", paymentStatus: "paid", totalCents: 5000 }), 0);
  assert.equal(amountToCollectCents({ paymentMethod: "cod", paymentStatus: "pending", totalCents: 5000 }), 5000);
});
