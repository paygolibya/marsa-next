import test from "node:test";
import assert from "node:assert/strict";
import { handleNewsletterSubscribe, type NewsletterSubscribeDb } from "./handler";

function req(body: unknown) {
  return new Request("http://localhost/api/newsletter/subscribe", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(opts: { store?: { id: string }; createThrows?: { code: string } }) {
  const calls: { create?: unknown } = {};
  const db: NewsletterSubscribeDb = {
    store: { findUnique: async () => opts.store ?? null },
    newsletterSubscriber: {
      create: async (args) => {
        calls.create = args;
        if (opts.createThrows) throw opts.createThrows;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an invalid email with 400", async () => {
  const { db } = makeFakeDb({ store: { id: "store-1" } });
  const res = await handleNewsletterSubscribe(db, req({ storeSlug: "s", email: "not-an-email" }));
  assert.equal(res.status, 400);
});

test("returns 404 for an unknown store", async () => {
  const { db } = makeFakeDb({});
  const res = await handleNewsletterSubscribe(db, req({ storeSlug: "nope", email: "a@b.com" }));
  assert.equal(res.status, 404);
});

test("normalizes the email (trim + lowercase) before storing", async () => {
  const { db, calls } = makeFakeDb({ store: { id: "store-1" } });
  await handleNewsletterSubscribe(db, req({ storeSlug: "s", email: "  A@B.COM  " }));
  assert.equal((calls.create as any).data.email, "a@b.com");
});

test("treats a duplicate subscription as success (P2002), not an error the visitor sees", async () => {
  const { db } = makeFakeDb({ store: { id: "store-1" }, createThrows: { code: "P2002" } });
  const res = await handleNewsletterSubscribe(db, req({ storeSlug: "s", email: "a@b.com" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});

test("subscribes a new email successfully", async () => {
  const { db, calls } = makeFakeDb({ store: { id: "store-1" } });
  const res = await handleNewsletterSubscribe(db, req({ storeSlug: "s", email: "buyer@example.com" }));
  assert.equal(res.status, 200);
  assert.equal((calls.create as any).data.storeId, "store-1");
});
