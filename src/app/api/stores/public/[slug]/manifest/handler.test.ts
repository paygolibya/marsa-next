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
  assert.deepEqual(body.icons, []);
});

test("prefers favicon over logo when both are set", async () => {
  const db = makeFakeDb({ name: "متجري", customization: { logo: "logo.png", favicon: "favicon.png", primaryColor: null, secondaryColor: null } });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.icons[0].src, "favicon.png");
});

test("falls back to logo when favicon isn't set", async () => {
  const db = makeFakeDb({ name: "متجري", customization: { logo: "logo.png", favicon: null, primaryColor: null, secondaryColor: null } });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.icons[0].src, "logo.png");
});

test("truncates short_name to 20 characters, per the Web App Manifest spec's practical limit", async () => {
  const db = makeFakeDb({ name: "A Very Long Store Name That Exceeds Twenty Characters", customization: null });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.short_name.length, 20);
});

test("uses the merchant's own colors when set", async () => {
  const db = makeFakeDb({ name: "متجري", customization: { logo: null, favicon: null, primaryColor: "#123456", secondaryColor: "#abcdef" } });
  const res = await handleGetManifest(db, "my-store");
  const body = await res.json();
  assert.equal(body.theme_color, "#123456");
  assert.equal(body.background_color, "#abcdef");
});
