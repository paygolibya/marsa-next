import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleInquiriesByStore, type InquiriesByStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/inquiries/by-store/store-1", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/inquiries/by-store/store-1");
}

type FakeInquiry = Awaited<ReturnType<InquiriesByStoreDb["inquiry"]["findMany"]>>[number];

function makeFakeDb(opts: { ownedStoreId?: string; inquiries?: FakeInquiry[] }) {
  const calls: { inquiryWhere?: unknown } = {};
  const db: InquiriesByStoreDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    inquiry: {
      findMany: async (args) => {
        calls.inquiryWhere = args.where;
        return opts.inquiries ?? [];
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleInquiriesByStore(db, noTokenReq(), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleInquiriesByStore(db, req(), "store-1");
  assert.equal(res.status, 403);
});

test("returns the owned store's inquiries, scoped by the resolved store id", async () => {
  const inquiries: FakeInquiry[] = [
    { id: "i1", productId: null, buyerName: "Buyer", buyerPhone: "0911111111", message: "hi", handled: false, createdAt: new Date(), product: null },
  ];
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", inquiries });
  const res = await handleInquiriesByStore(db, req(), "store-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.deepEqual(calls.inquiryWhere, { storeId: "store-1" });
});
