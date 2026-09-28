import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { handleSetVariantOptions, type VariantOptionsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/products/product-1/variant-options", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/products/product-1/variant-options", { method: "POST", body: JSON.stringify(body) });
}

// Each array element (db.product.update(...), db.productVariant.deleteMany(...),
// etc.) is a real invocation of an async fake — by the time the array
// literal is built, those calls have already fired and returned Promises,
// so this fake just needs to await them all, matching how the real
// Prisma $transaction([...]) array form is used in handler.ts.
function makeFakeDb(opts: { product?: { id: string; storeId: string }; ownedStoreId?: string; existingVariants?: { id: string; productId: string; options: unknown }[] }) {
  let variants = opts.existingVariants ?? [];
  const calls: Record<string, unknown> = {};
  const db: VariantOptionsDb = {
    product: {
      findUnique: async (args) => (opts.product && opts.product.id === args.where.id ? opts.product : null),
      update: async (args) => {
        calls.productUpdate = args;
        return {};
      },
    },
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    productVariant: {
      findMany: async () => variants,
      deleteMany: async (args) => {
        calls.deleteMany = args;
        const toDelete = new Set(args.where.id.in);
        variants = variants.filter((v) => !toDelete.has(v.id));
        return {};
      },
      createMany: async (args) => {
        calls.createMany = args;
        let nextId = variants.length;
        for (const d of args.data) {
          variants.push({ id: `new-${nextId++}`, productId: d.productId, options: d.options });
        }
        return {};
      },
    },
    $transaction: async (ops) => Promise.all(ops),
  };
  return { db, calls, getVariants: () => variants };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleSetVariantOptions(db, noTokenReq({ options: [] }), "product-1");
  assert.equal(res.status, 401);
});

test("rejects a product belonging to a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleSetVariantOptions(db, req({ options: [] }), "product-1");
  assert.equal(res.status, 403);
});

test("rejects more than 2 option types (validation limit)", async () => {
  const { db } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const options = [
    { name: "الحجم", values: ["S"] },
    { name: "اللون", values: ["أحمر"] },
    { name: "المادة", values: ["قطن"] },
  ];
  const res = await handleSetVariantOptions(db, req({ options }), "product-1");
  assert.equal(res.status, 400);
});

test("a fresh set of options generates the full cartesian product of variants", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const options = [
    { name: "الحجم", values: ["S", "M"] },
    { name: "اللون", values: ["أحمر", "أزرق"] },
  ];
  const res = await handleSetVariantOptions(db, req({ options }), "product-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.variants.length, 4); // 2 sizes x 2 colors
  assert.equal((calls.createMany as any).data.length, 4);
  assert.equal(calls.deleteMany, undefined);
});

test("an existing variant whose combination still appears is left untouched, not recreated", async () => {
  const existingVariants = [{ id: "v1", productId: "product-1", options: { الحجم: "S" } }];
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingVariants });
  const options = [{ name: "الحجم", values: ["S", "M"] }]; // S already exists, M is new
  await handleSetVariantOptions(db, req({ options }), "product-1");
  // Only the new combination (M) should be created — S is untouched.
  const created = (calls.createMany as any).data;
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].options, { الحجم: "M" });
  assert.equal(calls.deleteMany, undefined);
});

test("a variant whose combination was removed (value no longer offered) gets deleted", async () => {
  const existingVariants = [
    { id: "v1", productId: "product-1", options: { الحجم: "S" } },
    { id: "v2", productId: "product-1", options: { الحجم: "M" } },
  ];
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingVariants });
  const options = [{ name: "الحجم", values: ["S"] }]; // M was removed
  await handleSetVariantOptions(db, req({ options }), "product-1");
  assert.deepEqual((calls.deleteMany as any).where.id.in, ["v2"]);
  assert.equal(calls.createMany, undefined);
});

test("combination matching ignores key order — a variant stored with keys in a different order isn't treated as new", async () => {
  // The DB row happens to have its JSON keys in reverse order vs. how the
  // request would generate the same combination — comboKey must still
  // treat these as identical, or this variant would be wrongly deleted
  // and recreated (losing its price/stock).
  const existingVariants = [{ id: "v1", productId: "product-1", options: { اللون: "أحمر", الحجم: "S" } }];
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingVariants });
  const options = [
    { name: "الحجم", values: ["S"] },
    { name: "اللون", values: ["أحمر"] },
  ];
  await handleSetVariantOptions(db, req({ options }), "product-1");
  assert.equal(calls.deleteMany, undefined);
  assert.equal(calls.createMany, undefined);
});

test("empty options clears variantOptions on the product (Prisma.JsonNull) and deletes every variant", async () => {
  const existingVariants = [{ id: "v1", productId: "product-1", options: { الحجم: "S" } }];
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingVariants });
  const res = await handleSetVariantOptions(db, req({ options: [] }), "product-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.deleteMany as any).where.id.in, ["v1"]);
  assert.equal((calls.productUpdate as any).data.variantOptions, Prisma.JsonNull);
});
