import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleMarkInquiryHandled, type MarkInquiryHandledDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authHeader(merchantId: string) {
  return { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` };
}

function req(merchantId: string | null) {
  return new Request("http://localhost/api/inquiries/inquiry-1", {
    method: "PATCH",
    headers: merchantId ? authHeader(merchantId) : {},
  });
}

function makeFakeDb(inquiry: { id: string } | null) {
  const calls: { update?: unknown } = {};
  const db: MarkInquiryHandledDb = {
    inquiry: {
      findFirst: async (args) => {
        if (!inquiry) return null;
        assert.equal(args.where.id, "inquiry-1");
        assert.ok(args.where.store.merchantId, "must filter by the authenticated merchant's ownership");
        return inquiry;
      },
      update: async (args) => {
        calls.update = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects with 401 when there is no auth token", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleMarkInquiryHandled(db, req(null), "inquiry-1");
  assert.equal(res.status, 401);
});

test("returns 403 when no inquiry matches (wrong store or doesn't exist)", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleMarkInquiryHandled(db, req("merchant-1"), "inquiry-1");
  assert.equal(res.status, 403);
});

test("marks the inquiry handled", async () => {
  const { db, calls } = makeFakeDb({ id: "inquiry-1" });
  const res = await handleMarkInquiryHandled(db, req("merchant-1"), "inquiry-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.update, { where: { id: "inquiry-1" }, data: { handled: true } });
});
