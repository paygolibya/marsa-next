import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSupportChat, type SupportChatDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
// Deliberately left unset: runSupportAgent falls back to a canned Arabic
// "support isn't enabled" reply when ANTHROPIC_API_KEY is missing (the same
// mock-fallback convention as sms.ts/email.ts) — this test suite exercises
// the real function, not a mock, without needing network access or a fake.
delete process.env.ANTHROPIC_API_KEY;

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/support/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/support/chat", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(opts: { existingConversation?: { id: string; merchantId: string; storeId: string | null }; priorMessages?: { role: string; content: string }[] } = {}) {
  const calls: Record<string, unknown> = {};
  const conversation = opts.existingConversation ?? null;
  const db: SupportChatDb = {
    store: {
      findFirst: async (args) => {
        calls.storeFindFirst = args;
        return { id: "store-1" };
      },
    },
    supportConversation: {
      findFirst: async (args) => {
        calls.conversationFindFirst = args;
        return conversation && conversation.id === args.where.id && conversation.merchantId === args.where.merchantId ? conversation : null;
      },
      create: async (args) => {
        calls.conversationCreate = args;
        return { id: "new-conversation-1", merchantId: args.data.merchantId, storeId: args.data.storeId };
      },
      update: async (args) => {
        calls.conversationUpdate = args;
        return {};
      },
    },
    supportMessage: {
      findMany: async (args) => {
        calls.messageFindMany = args;
        return opts.priorMessages ?? [];
      },
      create: async (args) => {
        (calls.messageCreates ??= []) as unknown[];
        (calls.messageCreates as unknown[]).push(args);
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleSupportChat(db, noTokenReq({ message: "مرحبا" }));
  assert.equal(res.status, 401);
});

test("rejects an empty message with 400", async () => {
  const { db } = makeFakeDb();
  const res = await handleSupportChat(db, req({ message: "   " }));
  assert.equal(res.status, 400);
});

test("creates a new conversation attached to the merchant's own store when none is given", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleSupportChat(db, req({ message: "كيف أضيف منتج؟" }, "merchant-42"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.conversationId, "new-conversation-1");
  assert.equal((calls.conversationCreate as any).data.merchantId, "merchant-42");
  assert.equal((calls.conversationCreate as any).data.storeId, "store-1");
});

test("reuses an existing conversation the merchant owns instead of creating a new one", async () => {
  const { db, calls } = makeFakeDb({ existingConversation: { id: "conv-1", merchantId: "merchant-1", storeId: "store-1" } });
  const res = await handleSupportChat(db, req({ message: "سؤال آخر", conversationId: "conv-1" }, "merchant-1"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.conversationId, "conv-1");
  assert.equal(calls.conversationCreate, undefined);
});

test("a conversationId belonging to a different merchant is ignored, not reused — a new conversation is created instead", async () => {
  const { db, calls } = makeFakeDb({ existingConversation: { id: "conv-1", merchantId: "someone-else", storeId: "store-1" } });
  const res = await handleSupportChat(db, req({ message: "سؤال", conversationId: "conv-1" }, "merchant-1"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.conversationId, "new-conversation-1");
  assert.ok(calls.conversationCreate, "expected a fresh conversation to be created rather than reusing another merchant's");
});

test("persists both the user's message and the assistant's reply", async () => {
  const { db, calls } = makeFakeDb();
  await handleSupportChat(db, req({ message: "مرحبا" }));
  const creates = calls.messageCreates as any[];
  assert.equal(creates.length, 2);
  assert.equal(creates[0].data.role, "user");
  assert.equal(creates[0].data.content, "مرحبا");
  assert.equal(creates[1].data.role, "assistant");
  assert.ok(typeof creates[1].data.content === "string" && creates[1].data.content.length > 0);
});

test("returns the mock-fallback reply when ANTHROPIC_API_KEY isn't configured, rather than throwing", async () => {
  const { db } = makeFakeDb();
  const res = await handleSupportChat(db, req({ message: "مرحبا" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.reply, /غير مفعّل/);
});
