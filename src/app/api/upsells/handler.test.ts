import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateUpsell, handleListUpsells, type UpsellsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; storeProductIds?: string[]; createThrows?: { code: string } } = {}) {
  const calls: Record<string, unknown> = {};
  const db: UpsellsDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    product: {
      findMany: async (args) => {
        const ids = args.where.id.in as string[];
        return (opts.storeProductIds ?? []).filter((id) => ids.includes(id)).map((id) => ({ id }));
      },
    },
    upsell: {
      create: async (args) => {
        calls.upsellCreate = args;
        if (opts.createThrows) throw opts.createThrows;
        return {
          id: "upsell-1",
          storeId: args.data.storeId,
          triggerProductId: args.data.triggerProductId,
          offeredProductId: args.data.offeredProductId,
          active: true,
          triggerProduct: { name: "Trigger" },
          offeredProduct: { name: "Offered" },
        };
      },
      findMany: async (args) => {
        calls.upsellFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", triggerProductId: "product-1", offeredProductId: "product-2" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleCreateUpsell(db, new Request("http://localhost/api/upsells", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateUpsell(db, authReq("http://localhost/api/upsells", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.upsellCreate, undefined);
});

test("POST rejects the trigger and offered product being the same with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1"] });
  const res = await handleCreateUpsell(
    db,
    authReq("http://localhost/api/upsells", { method: "POST", body: JSON.stringify({ ...validBody, offeredProductId: "product-1" }) })
  );
  assert.equal(res.status, 400);
  assert.equal(calls.upsellCreate, undefined);
});

test("POST rejects a product that doesn't belong to this store with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1"] }); // product-2 missing
  const res = await handleCreateUpsell(db, authReq("http://localhost/api/upsells", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 400);
  assert.equal(calls.upsellCreate, undefined);
});

test("POST creates the upsell when both products belong to this store", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleCreateUpsell(db, authReq("http://localhost/api/upsells", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  assert.ok(calls.upsellCreate);
});

test("POST maps a duplicate-pair unique-constraint violation to a real 400, not a 500", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"], createThrows: { code: "P2002" } });
  const res = await handleCreateUpsell(db, authReq("http://localhost/api/upsells", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 400);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListUpsells(db, new Request("http://localhost/api/upsells?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListUpsells(db, authReq("http://localhost/api/upsells"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListUpsells(db, authReq("http://localhost/api/upsells?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's upsells", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListUpsells(db, authReq("http://localhost/api/upsells?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.upsellFindMany as { where: { storeId: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
});
