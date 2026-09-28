import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListVanexPickups, handleRequestVanexPickup, type VanexPickupsDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

const validPickupBody = { phone: "0912345678", numberOfPackages: 3, address: "123 Main St", mapUrl: "https://maps.google.com/x" };

function makeFakeDeps() {
  const calls: { listArgs?: unknown; requestArgs?: unknown } = {};
  const deps: VanexPickupsDeps = {
    listVanexPickups: async (status) => {
      calls.listArgs = status;
      return [{ id: 1, status }];
    },
    requestVanexPickup: async (input) => {
      calls.requestArgs = input;
      return { collectId: 999 };
    },
  };
  return { deps, calls };
}

test("GET rejects a non-admin/unauthenticated request with 403", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleListVanexPickups(deps, noTokenReq("http://localhost/api/admin/vanex/pickups"));
  assert.equal(res.status, 403);
});

test("GET defaults to status=1 (pending) when no query param is given", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleListVanexPickups(deps, adminReq("http://localhost/api/admin/vanex/pickups"));
  assert.equal(calls.listArgs, 1);
});

test("GET respects an explicit status query param", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleListVanexPickups(deps, adminReq("http://localhost/api/admin/vanex/pickups?status=3"));
  assert.equal(calls.listArgs, 3);
});

test("GET returns 500 (not unhandled) when the Vanex API call fails", async () => {
  const deps: VanexPickupsDeps = {
    listVanexPickups: async () => { throw new Error("Vanex down"); },
    requestVanexPickup: async () => ({}),
  };
  const res = await handleListVanexPickups(deps, adminReq("http://localhost/api/admin/vanex/pickups"));
  assert.equal(res.status, 500);
});

test("POST rejects a non-admin/unauthenticated request with 403", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleRequestVanexPickup(deps, noTokenReq("http://localhost/x", { method: "POST", body: JSON.stringify(validPickupBody) }));
  assert.equal(res.status, 403);
});

test("POST rejects a request missing a required field with 400, before calling Vanex", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleRequestVanexPickup(deps, adminReq("http://localhost/x", { method: "POST", body: JSON.stringify({ phone: "0912345678" }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.requestArgs, undefined);
});

test("POST requests a real pickup with all fields on success", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleRequestVanexPickup(deps, adminReq("http://localhost/x", { method: "POST", body: JSON.stringify(validPickupBody) }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal((calls.requestArgs as any).phone, "0912345678");
});
