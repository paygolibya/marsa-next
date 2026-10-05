import test from "node:test";
import assert from "node:assert/strict";
import { handleGetPublicPage, type PublicPageDb } from "./handler";

function makeFakeDb(opts: { store?: { id: string } | null; page?: { title: string; content: string } | null }) {
  const db: PublicPageDb = {
    store: { findUnique: async () => opts.store ?? null },
    page: { findUnique: async () => opts.page ?? null },
  };
  return { db };
}

test("returns 404 when the store doesn't exist", async () => {
  const { db } = makeFakeDb({ store: null });
  const res = await handleGetPublicPage(db, "no-store", "about");
  assert.equal(res.status, 404);
});

test("returns 404 when the page doesn't exist for this store", async () => {
  const { db } = makeFakeDb({ store: { id: "store-1" }, page: null });
  const res = await handleGetPublicPage(db, "my-store", "about");
  assert.equal(res.status, 404);
});

test("returns the page's title and content", async () => {
  const { db } = makeFakeDb({ store: { id: "store-1" }, page: { title: "عن المتجر", content: "نص الصفحة" } });
  const res = await handleGetPublicPage(db, "my-store", "about");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.title, "عن المتجر");
  assert.equal(body.content, "نص الصفحة");
});
