import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleBulkImport, type BulkImportDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function reqWithForm(form: FormData, merchantId = "merchant-1") {
  return new Request("http://localhost/api/products/bulk-import", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: form,
  });
}

function noTokenReq(form: FormData) {
  return new Request("http://localhost/api/products/bulk-import", { method: "POST", body: form });
}

function csvForm(csv: string, storeId = "store-1") {
  const form = new FormData();
  form.set("storeId", storeId);
  form.set("file", new File([csv], "products.csv", { type: "text/csv" }));
  return form;
}

function makeFakeDb(ownedStoreId?: string) {
  const calls: { createMany?: unknown } = {};
  const db: BulkImportDb = {
    store: { findFirst: async (args) => (ownedStoreId && args.where.id === ownedStoreId ? { id: ownedStoreId } : null) },
    product: {
      createMany: async (args) => {
        calls.createMany = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb("store-1");
  const res = await handleBulkImport(db, noTokenReq(csvForm("name,price,imageUrl,stock\nWidget,10,,\n")));
  assert.equal(res.status, 401);
});

test("rejects a request missing the file with 400", async () => {
  const { db } = makeFakeDb("store-1");
  const form = new FormData();
  form.set("storeId", "store-1");
  const res = await handleBulkImport(db, reqWithForm(form));
  assert.equal(res.status, 400);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb("some-other-store");
  const res = await handleBulkImport(db, reqWithForm(csvForm("name,price,imageUrl,stock\nWidget,10,,\n")));
  assert.equal(res.status, 403);
  assert.equal(calls.createMany, undefined);
});

test("imports valid rows and reports invalid ones by row number, without failing the whole batch", async () => {
  const csv = [
    "name,price,imageUrl,stock",
    "Widget,10,,5", // valid — row 2
    ",10,,5", // missing name — row 3
    "Gadget,not-a-number,,5", // bad price — row 4
    "Gizmo,15,https://x.com/a.jpg,not-a-number", // bad stock — row 5
    "Thing,20,,", // valid, no stock tracking — row 6
  ].join("\n");
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleBulkImport(db, reqWithForm(csvForm(csv)));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.createdCount, 2);
  assert.equal(body.errors.length, 3);
  assert.deepEqual(
    body.errors.map((e: any) => e.row).sort(),
    [3, 4, 5]
  );
  const created = (calls.createMany as any).data;
  assert.equal(created.length, 2);
  assert.equal(created[0].name, "Widget");
  assert.equal(created[0].priceCents, 1000); // 10 LYD -> 1000 cents
  assert.equal(created[0].trackInventory, true);
  assert.equal(created[1].name, "Thing");
  assert.equal(created[1].trackInventory, false);
});

test("skips the createMany call entirely when every row is invalid", async () => {
  const csv = ["name,price,imageUrl,stock", ",10,,", "Widget,bad-price,,"].join("\n");
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleBulkImport(db, reqWithForm(csvForm(csv)));
  const body = await res.json();
  assert.equal(body.createdCount, 0);
  assert.equal(calls.createMany, undefined);
});

test("keeps imageUrl and images[0] in sync for imported rows, same as every other product-creation path", async () => {
  const csv = ["name,price,imageUrl,stock", "Widget,10,https://x.com/a.jpg,"].join("\n");
  const { db, calls } = makeFakeDb("store-1");
  await handleBulkImport(db, reqWithForm(csvForm(csv)));
  const created = (calls.createMany as any).data[0];
  assert.equal(created.imageUrl, "https://x.com/a.jpg");
  assert.deepEqual(created.images, ["https://x.com/a.jpg"]);
});
