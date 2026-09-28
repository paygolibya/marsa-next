import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleStoresMine, type StoresMineDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/stores/mine", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/stores/mine");
}

test("rejects an unauthenticated request with 401", async () => {
  const db: StoresMineDb = { store: { findMany: async () => [] } };
  const res = await handleStoresMine(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("scopes the query to the authenticated merchant only", async () => {
  let receivedWhere: unknown;
  const db: StoresMineDb = {
    store: {
      findMany: async (args) => {
        receivedWhere = args.where;
        return [{ id: "store-1" }];
      },
    },
  };
  const res = await handleStoresMine(db, req("merchant-42"));
  assert.equal(res.status, 200);
  assert.deepEqual(receivedWhere, { merchantId: "merchant-42" });
});
