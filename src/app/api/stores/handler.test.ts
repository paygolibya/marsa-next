import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateStore, type CreateStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/stores", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/stores", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(opts: { existingSlugs?: string[]; template?: { defaultColors: unknown } } = {}) {
  const calls: Record<string, unknown> = {};
  const db: CreateStoreDb = {
    store: {
      findUnique: async (args) => ((opts.existingSlugs ?? []).includes(args.where.slug) ? { id: "clash-store" } : null),
      create: async (args) => {
        calls.create = args;
        return { id: "store-1", slug: (args.data as any).slug };
      },
    },
    template: {
      findUnique: async () => opts.template ?? null,
    },
    templateCustomization: {
      upsert: async (args) => {
        calls.upsert = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleCreateStore(db, noTokenReq({ name: "متجري" }));
  assert.equal(res.status, 401);
});

test("rejects a missing name with 400", async () => {
  const { db } = makeFakeDb();
  const res = await handleCreateStore(db, req({}));
  assert.equal(res.status, 400);
});

test("generates a real slug from the store name", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleCreateStore(db, req({ name: "My Cool Store" }));
  assert.equal(res.status, 201);
  const create = calls.create as { data: { slug: string } };
  assert.equal(create.data.slug, "my-cool-store");
});

test("appends a random suffix when the generated slug already exists, rather than colliding silently", async () => {
  const { db, calls } = makeFakeDb({ existingSlugs: ["my-cool-store"] });
  await handleCreateStore(db, req({ name: "My Cool Store" }));
  const create = calls.create as { data: { slug: string } };
  assert.notEqual(create.data.slug, "my-cool-store");
  assert.ok(create.data.slug.startsWith("my-cool-store-"));
});

test("defaults courier/codEnabled/theme when not specified", async () => {
  const { db, calls } = makeFakeDb();
  await handleCreateStore(db, req({ name: "Store" }));
  const create = calls.create as { data: { theme: string; courier: string; codEnabled: boolean } };
  assert.equal(create.data.theme, "souk");
  assert.equal(create.data.courier, "vanex");
  assert.equal(create.data.codEnabled, true);
});

test("applies the chosen template's own default colors, not a hardcoded blue", async () => {
  const { db, calls } = makeFakeDb({ template: { defaultColors: { primaryColor: "#111111", secondaryColor: "#222222" } } });
  await handleCreateStore(db, req({ name: "Store", templateId: "template-dark" }));
  const upsert = calls.upsert as { create: { primaryColor: string; secondaryColor: string } };
  assert.equal(upsert.create.primaryColor, "#111111");
  assert.equal(upsert.create.secondaryColor, "#222222");
});

test("skips the template-customization step entirely when no templateId is given", async () => {
  const { db, calls } = makeFakeDb();
  await handleCreateStore(db, req({ name: "Store" }));
  assert.equal(calls.upsert, undefined);
});
