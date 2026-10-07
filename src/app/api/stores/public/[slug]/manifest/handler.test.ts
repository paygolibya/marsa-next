import test from "node:test";
import assert from "node:assert/strict";
import { handleGetManifest, type ManifestDb } from "./handler";

function makeFakeDb(store: { name: string; customization: any } | null) {
  const db: ManifestDb = { store: { findUnique: async () => store } };
  return db;
}

test("returns 404 for a nonexistent slug", async () => {
  const db = makeFakeDb(null);
  const res = await handleGetManifest(db, "nope");
  assert.equal(res.status, 404);
});

test("falls back to platform defaults when no customization exists", async () => {
  const db = makeFakeDb({ name: "متجري", customization: null });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.background_color, "#ffffff");
  assert.equal(body.theme_color, "#0E2A3F");
});

// icons: [] used to be possible whenever a store had no logo/favicon set
// — that fails Chrome's installability criteria outright. Every icon now
// routes through its own resizing endpoint (handler.test.ts in ../icon),
// which has its own platform-icon fallback, so the manifest always ships
// a real icon array regardless of what the merchant has uploaded.
test("always ships 3 icon entries (192 any, 512 any, 512 maskable), routed through the icon endpoint, never icons: []", async () => {
  const db = makeFakeDb({ name: "متجري", customization: null });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.icons.length, 3);
  assert.deepEqual(
    body.icons.map((i: any) => [i.sizes, i.purpose, i.type]),
    [
      ["192x192", "any", "image/png"],
      ["512x512", "any", "image/png"],
      ["512x512", "maskable", "image/png"],
    ]
  );
  for (const i of body.icons) {
    assert.match(i.src, /^\/api\/stores\/public\/my-store\/icon\?size=(192|512)(&purpose=maskable)?$/);
  }
});

test("truncates short_name at a word boundary with an ellipsis, not mid-word", async () => {
  const db = makeFakeDb({ name: "A Very Long Store Name That Exceeds Twenty Characters", customization: null });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.ok(body.short_name.length <= 20);
  assert.equal(body.short_name, "A Very Long Store…");
});

test("short_name is left untouched when it already fits", async () => {
  const db = makeFakeDb({ name: "متجري", customization: null });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.short_name, "متجري");
});

test("uses the merchant's own colors when set", async () => {
  const db = makeFakeDb({ name: "متجري", customization: { primaryColor: "#123456", secondaryColor: "#abcdef" } });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.theme_color, "#123456");
  assert.equal(body.background_color, "#abcdef");
});
