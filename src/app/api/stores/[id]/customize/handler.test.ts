import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCustomizeGet, handleCustomizePost, type CustomizeDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authHeader(merchantId: string) {
  return { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` };
}

function req(body: unknown, merchantId: string | null, method: "POST" | "GET" = "POST") {
  return new Request("http://localhost/api/stores/store-1/customize", {
    method,
    headers: { "Content-Type": "application/json", ...(merchantId ? authHeader(merchantId) : {}) },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function makeFakeDb(storeExists: boolean) {
  const calls: { upsert?: any; deleteMany?: unknown; createManyAndReturn?: any } = {};
  const db: CustomizeDb = {
    store: {
      findFirst: async (args) => {
        assert.equal(args.where.id, "store-1");
        assert.ok(args.where.merchantId, "must scope the lookup to the authenticated merchant");
        return storeExists ? { id: "store-1" } : null;
      },
    },
    templateCustomization: {
      upsert: async (args) => {
        calls.upsert = args;
        return { id: "cust-1", ...args.create };
      },
      findUnique: async () => ({
        id: "cust-1",
        sectionOrder: null,
        showSocialProof: true,
        showTestimonials: false,
        showNewsletter: true,
      }),
    },
    storeSection: {
      deleteMany: async (args) => {
        calls.deleteMany = args;
        return {};
      },
      createManyAndReturn: async (args) => {
        calls.createManyAndReturn = args;
        return args.data;
      },
      findMany: async () => [],
    },
    $transaction: async (ops) => Promise.all(ops),
  };
  return { db, calls };
}

test("POST rejects with 401 when there is no auth token", async () => {
  const { db } = makeFakeDb(true);
  const res = await handleCustomizePost(db, req({}, null), "store-1");
  assert.equal(res.status, 401);
});

test("POST returns 403 when the store isn't found or isn't owned by this merchant", async () => {
  const { db } = makeFakeDb(false);
  const res = await handleCustomizePost(db, req({}, "merchant-1"), "store-1");
  assert.equal(res.status, 403);
});

test("POST create path: unset boolean fields default to their documented defaults (!== false, not falsy-check)", async () => {
  const { db, calls } = makeFakeDb(true);
  // showLogo/showStoreName/etc omitted entirely — the create branch must
  // still default them to true (`!== false`), not to false/undefined. A
  // regression here (e.g. accidentally using `showLogo &&` instead of
  // `showLogo !== false`) would silently hide every new store's logo.
  await handleCustomizePost(db, req({}, "merchant-1"), "store-1");
  assert.equal(calls.upsert.create.showLogo, true);
  assert.equal(calls.upsert.create.showStoreName, true);
  assert.equal(calls.upsert.create.heroEnabled, true);
  assert.equal(calls.upsert.create.showTestimonials, false); // the one that defaults OFF
});

test("POST create path: an explicit false is respected, not overridden by the default", async () => {
  const { db, calls } = makeFakeDb(true);
  await handleCustomizePost(db, req({ showLogo: false, showStoreName: false }, "merchant-1"), "store-1");
  assert.equal(calls.upsert.create.showLogo, false);
  assert.equal(calls.upsert.create.showStoreName, false);
});

test("POST update path: an omitted boolean field is left undefined (unchanged), never forced to a default", async () => {
  // This is the exact distinction the create branch doesn't have — on
  // update, omitting a field must mean "leave it as it is in the DB", not
  // "reset to the create-time default". Regressing this would silently
  // flip a merchant's existing showLogo back to true on every unrelated save.
  const { db, calls } = makeFakeDb(true);
  await handleCustomizePost(db, req({ tagline: "new tagline" }, "merchant-1"), "store-1");
  assert.equal(calls.upsert.update.showLogo, undefined);
  assert.equal(calls.upsert.update.showStoreName, undefined);
  assert.equal(calls.upsert.update.tagline, "new tagline");
});

test("POST update path: an invalid enum value is dropped (undefined), not persisted as garbage", async () => {
  const { db, calls } = makeFakeDb(true);
  await handleCustomizePost(db, req({ logoSize: "gigantic", textSize: "lg" }, "merchant-1"), "store-1");
  assert.equal(calls.upsert.update.logoSize, undefined);
  assert.equal(calls.upsert.update.textSize, "lg");
});

test("POST only touches sections when the payload includes them", async () => {
  const { db: db1, calls: calls1 } = makeFakeDb(true);
  await handleCustomizePost(db1, req({}, "merchant-1"), "store-1"); // no `sections` key at all
  assert.equal(calls1.deleteMany, undefined);
  assert.equal(calls1.createManyAndReturn, undefined);

  const { db: db2, calls: calls2 } = makeFakeDb(true);
  await handleCustomizePost(db2, req({ sections: [{ type: "stats", enabled: true, settings: {} }] }, "merchant-1"), "store-1");
  assert.ok(calls2.deleteMany);
  assert.ok(calls2.createManyAndReturn);
  assert.equal(calls2.createManyAndReturn.data[0].type, "stats");
  assert.equal(calls2.createManyAndReturn.data[0].position, 0); // position is the array index, never client-supplied
});

test("GET rejects with 401 when there is no auth token", async () => {
  const { db } = makeFakeDb(true);
  const res = await handleCustomizeGet(db, req({}, null, "GET"), "store-1");
  assert.equal(res.status, 401);
});

test("GET returns 403 when the store isn't owned by this merchant", async () => {
  const { db } = makeFakeDb(false);
  const res = await handleCustomizeGet(db, req({}, "merchant-1", "GET"), "store-1");
  assert.equal(res.status, 403);
});
