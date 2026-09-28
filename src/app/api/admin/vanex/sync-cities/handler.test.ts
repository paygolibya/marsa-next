import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSyncVanexCities, type SyncVanexCitiesDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/vanex/sync-cities", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/admin/vanex/sync-cities", { method: "POST" });
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const deps: SyncVanexCitiesDeps = { syncVanexCities: async () => ({ cities: 0, areas: 0 }) };
  const res = await handleSyncVanexCities(deps, noTokenReq());
  assert.equal(res.status, 403);
});

test("returns the real sync counts on success", async () => {
  const deps: SyncVanexCitiesDeps = { syncVanexCities: async () => ({ cities: 12, areas: 48 }) };
  const res = await handleSyncVanexCities(deps, adminReq());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.cities, 12);
  assert.equal(body.areas, 48);
});

test("returns 500 with an Arabic error message when the Vanex API call fails, not an unhandled exception", async () => {
  const deps: SyncVanexCitiesDeps = { syncVanexCities: async () => { throw new Error("Vanex API down"); } };
  const res = await handleSyncVanexCities(deps, adminReq());
  assert.equal(res.status, 500);
});
