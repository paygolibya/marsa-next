import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCancelVanexPickup, type CancelVanexPickupDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/vanex/pickups/42", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/admin/vanex/pickups/42", { method: "DELETE" });
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const deps: CancelVanexPickupDeps = { cancelVanexPickup: async () => true };
  const res = await handleCancelVanexPickup(deps, noTokenReq(), "42");
  assert.equal(res.status, 403);
});

test("cancels the pickup by its numeric collectId", async () => {
  let receivedId: number | undefined;
  const deps: CancelVanexPickupDeps = {
    cancelVanexPickup: async (id) => {
      receivedId = id;
      return true;
    },
  };
  const res = await handleCancelVanexPickup(deps, adminReq(), "42");
  assert.equal(res.status, 200);
  assert.equal(receivedId, 42);
});

test("returns 500 when the Vanex cancel call fails, not an unhandled exception", async () => {
  const deps: CancelVanexPickupDeps = { cancelVanexPickup: async () => { throw new Error("Vanex down"); } };
  const res = await handleCancelVanexPickup(deps, adminReq(), "42");
  assert.equal(res.status, 500);
});
