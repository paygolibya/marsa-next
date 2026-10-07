import test from "node:test";
import assert from "node:assert/strict";
import { handleGetStoreIcon, type StoreIconDb } from "./handler";

const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // not a real PNG, just distinguishable bytes

function makeFakeDb(store: { customization: any } | null) {
  const db: StoreIconDb = { store: { findUnique: async () => store } };
  return db;
}

function fakeRender(calls: any[]) {
  return async (sourceUrl: string | null, size: number, purpose: string, backgroundColor: string) => {
    calls.push({ sourceUrl, size, purpose, backgroundColor });
    return FAKE_PNG;
  };
}

test("returns 400 for an unsupported size", async () => {
  const db = makeFakeDb({ customization: null });
  const res = await handleGetStoreIcon(db, "my-store", new URLSearchParams("size=100"), fakeRender([]));
  assert.equal(res.status, 400);
});

test("returns 400 when size is missing entirely", async () => {
  const db = makeFakeDb({ customization: null });
  const res = await handleGetStoreIcon(db, "my-store", new URLSearchParams(""), fakeRender([]));
  assert.equal(res.status, 400);
});

test("returns 404 for a nonexistent store", async () => {
  const db = makeFakeDb(null);
  const res = await handleGetStoreIcon(db, "nope", new URLSearchParams("size=192"), fakeRender([]));
  assert.equal(res.status, 404);
});

test("renders a real PNG with cache headers for a valid request", async () => {
  const db = makeFakeDb({ customization: { favicon: null, logo: "https://example.com/logo.png", primaryColor: null } });
  const res = await handleGetStoreIcon(db, "my-store", new URLSearchParams("size=512"), fakeRender([]));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "image/png");
  assert.match(res.headers.get("Cache-Control") ?? "", /max-age=86400/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(bytes, FAKE_PNG);
});

test("prefers favicon over logo, passes size/purpose/background through to the renderer", async () => {
  const calls: any[] = [];
  const db = makeFakeDb({ customization: { favicon: "https://example.com/favicon.png", logo: "https://example.com/logo.png", primaryColor: "#123456" } });
  await handleGetStoreIcon(db, "my-store", new URLSearchParams("size=192&purpose=maskable"), fakeRender(calls));
  assert.deepEqual(calls, [{ sourceUrl: "https://example.com/favicon.png", size: 192, purpose: "maskable", backgroundColor: "#123456" }]);
});

test("defaults purpose to 'any' when not given, and falls back to a null source + default background when the store has no customization", async () => {
  const calls: any[] = [];
  const db = makeFakeDb({ customization: null });
  await handleGetStoreIcon(db, "my-store", new URLSearchParams("size=192"), fakeRender(calls));
  assert.deepEqual(calls, [{ sourceUrl: null, size: 192, purpose: "any", backgroundColor: "#0E2A3F" }]);
});

test("returns 500 (not an unhandled exception) when rendering fails", async () => {
  const db = makeFakeDb({ customization: null });
  const failingRender = async () => {
    throw new Error("sharp blew up");
  };
  const res = await handleGetStoreIcon(db, "my-store", new URLSearchParams("size=192"), failingRender);
  assert.equal(res.status, 500);
});
