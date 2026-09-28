import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleLatestConversation, type LatestConversationDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/support/conversations/latest", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/support/conversations/latest");
}

test("rejects an unauthenticated request with 401", async () => {
  const db: LatestConversationDb = { supportConversation: { findFirst: async () => null } };
  const res = await handleLatestConversation(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("returns an empty conversation when the merchant has never chatted before", async () => {
  const db: LatestConversationDb = { supportConversation: { findFirst: async () => null } };
  const res = await handleLatestConversation(db, req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { conversationId: null, messages: [] });
});

test("returns the most recent conversation's messages in order, scoped by merchantId in the query", async () => {
  let receivedWhere: unknown;
  const db: LatestConversationDb = {
    supportConversation: {
      findFirst: async (args) => {
        receivedWhere = args.where;
        return {
          id: "conv-1",
          messages: [
            { role: "user", content: "مرحبا" },
            { role: "assistant", content: "أهلاً، كيف أساعدك؟" },
          ],
        };
      },
    },
  };
  const res = await handleLatestConversation(db, req("merchant-7"));
  const body = await res.json();
  assert.equal(body.conversationId, "conv-1");
  assert.equal(body.messages.length, 2);
  assert.equal(body.messages[0].role, "user");
  assert.deepEqual(receivedWhere, { merchantId: "merchant-7" });
});
