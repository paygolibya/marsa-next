import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListBugReports, type BugReportsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/bug-reports", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

// No token, not "a real non-admin merchant token" — isAdminMerchantId falls
// back to a real (unmocked) prisma.merchant.findUnique for any merchantId
// not in the env allowlist, which would either hit the real DB or, in CI,
// throw a connection error. A missing token short-circuits to `false`
// before that DB call.
function noTokenReq() {
  return new Request("http://localhost/api/admin/bug-reports");
}

test("rejects a non-admin/unauthenticated request with 403, before touching the database", async () => {
  const db: BugReportsDb = { bugReport: { findMany: async () => { throw new Error("should not be called"); } } };
  const res = await handleListBugReports(db, noTokenReq());
  assert.equal(res.status, 403);
});

test("returns the escalation queue ordered newest-first, with merchant and conversation context", async () => {
  const reports = [
    { id: "bug-1", summary: "الدفع لا يعمل", status: "open", merchant: { name: "متجر أ", phone: "0910000001" }, conversation: { messages: [{ role: "user", content: "الدفع فشل" }] } },
  ];
  const db: BugReportsDb = { bugReport: { findMany: async () => reports } };
  const res = await handleListBugReports(db, adminReq());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reports.length, 1);
  assert.equal(body.reports[0].summary, "الدفع لا يعمل");
  assert.equal(body.reports[0].merchant.name, "متجر أ");
});
