import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSwitchTemplate, type SwitchTemplateDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/templates/modern/switch", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/templates/modern/switch", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(opts: { ownedStoreId?: string; template?: { id: string } | null }) {
  const calls: Record<string, unknown> = {};
  const db: SwitchTemplateDb = {
    template: { findFirst: async () => opts.template ?? null },
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
      update: async (args) => {
        calls.storeUpdate = args;
        return { id: args.where.id, templateId: args.data.templateId };
      },
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

// This is the actual vulnerability found while porting this route to DI:
// it previously had NO auth check at all — TemplateSwitcher.tsx (the only
// caller) never sent an Authorization header, and the route accepted any
// storeId from anyone, switching that store's template with no ownership
// check whatsoever. These two tests are the regression coverage for that.
test("rejects an unauthenticated request with 401 — this used to be entirely missing", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", template: { id: "template-1" } });
  const res = await handleSwitchTemplate(db, noTokenReq({ storeId: "store-1" }), "modern");
  assert.equal(res.status, 401);
  assert.equal(calls.storeUpdate, undefined);
});

test("rejects a store the requesting merchant doesn't own with 403 — this check also used to be entirely missing", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store", template: { id: "template-1" } });
  const res = await handleSwitchTemplate(db, req({ storeId: "store-1" }), "modern");
  assert.equal(res.status, 403);
  assert.equal(calls.storeUpdate, undefined);
});

test("returns 404 for an unknown template slug/id, before touching the store", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", template: null });
  const res = await handleSwitchTemplate(db, req({ storeId: "store-1" }), "nonexistent");
  assert.equal(res.status, 404);
  assert.equal(calls.storeUpdate, undefined);
});

test("switches the template for an owned store and syncs templateCustomization", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", template: { id: "template-1" } });
  const res = await handleSwitchTemplate(db, req({ storeId: "store-1" }), "modern");
  assert.equal(res.status, 200);
  const update = calls.storeUpdate as { where: { id: string }; data: { templateId: string } };
  assert.equal(update.where.id, "store-1");
  assert.equal(update.data.templateId, "template-1");
  const upsert = calls.upsert as { where: { storeId: string }; create: { templateId: string } };
  assert.equal(upsert.create.templateId, "template-1");
});
