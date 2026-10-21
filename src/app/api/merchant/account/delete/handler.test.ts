import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { handleDeleteAccount, type DeleteAccountDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
const HASH = bcrypt.hashSync("correct-pass", 4);

const req = (body: unknown, merchantId: string | null = "m1") =>
  new Request("http://localhost/api/merchant/account/delete", {
    method: "POST",
    headers: merchantId ? { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` } : {},
    body: JSON.stringify(body),
  });

function makeDeps(opts: { payouts?: number; commissions?: number } = {}) {
  const ops: string[] = [];
  const rec = (name: string) => async () => {
    ops.push(name);
    return {};
  };
  const tx = {
    store: { findMany: async () => [{ id: "s1" }], deleteMany: rec("store.deleteMany") },
    orderItem: { deleteMany: rec("orderItem.deleteMany") },
    order: { deleteMany: rec("order.deleteMany") },
    product: { deleteMany: rec("product.deleteMany") },
    commission: { deleteMany: rec("commission.deleteMany") },
    payout: { deleteMany: rec("payout.deleteMany") },
    bugReport: { deleteMany: rec("bugReport.deleteMany") },
    impersonationSession: { deleteMany: rec("impersonationSession.deleteMany") },
    merchant: { delete: rec("merchant.delete") },
  };
  const deps: DeleteAccountDeps = {
    db: {
      merchant: { findUnique: async () => ({ id: "m1", passwordHash: HASH }) },
      payout: { count: async () => opts.payouts ?? 0 },
      commission: { count: async () => opts.commissions ?? 0 },
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
  return { deps, ops };
}

test("requires login", async () => {
  assert.equal((await handleDeleteAccount(makeDeps().deps, req({ password: "x" }, null))).status, 401);
});

test("a wrong or missing password deletes nothing", async () => {
  const { deps, ops } = makeDeps();
  assert.equal((await handleDeleteAccount(deps, req({ password: "nope" }))).status, 403);
  assert.equal((await handleDeleteAccount(deps, req({}))).status, 400);
  assert.equal(ops.length, 0);
});

test("refused while a payout or commission is still owed to the merchant", async () => {
  for (const o of [{ payouts: 1 }, { commissions: 2 }]) {
    const { deps, ops } = makeDeps(o);
    assert.equal((await handleDeleteAccount(deps, req({ password: "correct-pass" }))).status, 409);
    assert.equal(ops.length, 0);
  }
});

test("deletes in the order the RESTRICT relations allow, merchant last", async () => {
  const { deps, ops } = makeDeps();
  const res = await handleDeleteAccount(deps, req({ password: "correct-pass" }));
  assert.equal(res.status, 200);
  const at = (n: string) => ops.indexOf(n);
  assert.ok(at("orderItem.deleteMany") < at("order.deleteMany"));
  assert.ok(at("order.deleteMany") < at("product.deleteMany"));
  assert.ok(at("product.deleteMany") < at("store.deleteMany"));
  assert.ok(at("commission.deleteMany") < at("payout.deleteMany"));
  assert.equal(ops[ops.length - 1], "merchant.delete");
});
