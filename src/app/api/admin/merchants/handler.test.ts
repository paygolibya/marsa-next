import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListMerchants, type ListMerchantsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(url: string) {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq(url: string) {
  return new Request(url);
}

function merchantFixture(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    name: "Test Merchant",
    phone: "0911111111",
    subscriptionTier: "basic",
    subscriptionStatus: "active",
    subscriptionEndDate: null,
    trialEndsAt: null,
    createdAt: new Date(),
    stores: [],
    ...overrides,
  };
}

function makeFakeDb(all: ReturnType<typeof merchantFixture>[]) {
  const calls: { findManyArgs?: unknown } = {};
  const db: ListMerchantsDb = {
    merchant: {
      findMany: async (args) => {
        calls.findManyArgs = args;
        const startIndex = args.cursor ? all.findIndex((m) => m.id === args.cursor!.id) + (args.skip ?? 0) : 0;
        return all.slice(startIndex, startIndex + args.take);
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const { db } = makeFakeDb([]);
  const res = await handleListMerchants(db, noTokenReq("http://localhost/api/admin/merchants"));
  assert.equal(res.status, 403);
});

test("returns nextCursor as null when fewer merchants exist than a full page", async () => {
  const all = [merchantFixture("m1")];
  const { db } = makeFakeDb(all);
  const res = await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants"));
  const body = await res.json();
  assert.equal(body.merchants.length, 1);
  assert.equal(body.nextCursor, null);
});

test("returns a real nextCursor (the last row's id) when a full page comes back, so the list can page further", async () => {
  const all = Array.from({ length: 100 }, (_, i) => merchantFixture(`m${i}`));
  const { db } = makeFakeDb(all);
  const res = await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants"));
  const body = await res.json();
  assert.equal(body.merchants.length, 100);
  assert.equal(body.nextCursor, "m99");
});

test("a cursor query resumes after that merchant, not from the start again", async () => {
  const all = Array.from({ length: 5 }, (_, i) => merchantFixture(`m${i}`));
  const { db, calls } = makeFakeDb(all);
  await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants?cursor=m2"));
  assert.deepEqual((calls.findManyArgs as any).cursor, { id: "m2" });
  assert.equal((calls.findManyArgs as any).skip, 1);
});

// Regression test for a real fix: this endpoint used to fetch merchants
// with `include: { stores: true }` and no `select` at all, which returns
// every raw column from Prisma — passwordHash and otpCodeHash included —
// straight into the JSON response. A real database would never let an
// explicit `select` silently include fields not listed in it, so this
// confirms the handler asks for an explicit, safe field list, not
// `include`/no-select.
test("never requests passwordHash or otpCodeHash from the database", async () => {
  const { db, calls } = makeFakeDb([merchantFixture("m1")]);
  await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants"));
  const args = calls.findManyArgs as { select?: Record<string, unknown>; include?: unknown };
  assert.ok(args.select, "must use an explicit select, not include/no-select");
  assert.equal(args.include, undefined);
  assert.equal("passwordHash" in args.select!, false);
  assert.equal("otpCodeHash" in args.select!, false);
});
