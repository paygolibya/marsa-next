import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleGetDomain, handleSetDomain, type MerchantDomainDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function getReq(storeId: string | null, merchantId = "merchant-1") {
  const url = new URL("http://localhost/api/merchant/domain");
  if (storeId) url.searchParams.set("storeId", storeId);
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` } });
}

function postReq(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/merchant/domain", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(url = "http://localhost/api/merchant/domain") {
  return new Request(url);
}

function makeFakeDeps(opts: {
  store?: { id: string; slug: string; customDomain: string | null; customDomainVerified: boolean };
  checkResult?: any;
  addResult?: any;
}) {
  const calls: Record<string, unknown> = {};
  const deps: MerchantDomainDeps = {
    db: {
      store: {
        findFirst: async (args) => (opts.store && args.where.id === opts.store.id ? opts.store : null),
        update: async (args) => {
          calls.update = args;
          return {};
        },
      },
    },
    addDomainToProject: async (domain) => {
      calls.addDomainToProject = domain;
      return opts.addResult ?? { ok: true, verified: false, records: [] };
    },
    checkDomainVerification: async (domain) => {
      calls.checkDomainVerification = domain;
      return opts.checkResult ?? { ok: true, verified: false, records: [] };
    },
    removeDomainFromProject: async (domain) => {
      calls.removeDomainFromProject = domain;
      return { ok: true };
    },
  };
  return { deps, calls };
}

test("GET rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps({});
  const res = await handleGetDomain(deps, noTokenReq());
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { deps } = makeFakeDeps({});
  const res = await handleGetDomain(deps, getReq(null));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { deps } = makeFakeDeps({});
  const res = await handleGetDomain(deps, getReq("store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the derived subdomain even when no custom domain is set", async () => {
  const { deps, calls } = makeFakeDeps({ store: { id: "store-1", slug: "my-shop", customDomain: null, customDomainVerified: false } });
  const res = await handleGetDomain(deps, getReq("store-1"));
  const body = await res.json();
  assert.equal(body.subdomain, "my-shop.rifqa.ly");
  assert.equal(body.customDomain, null);
  assert.equal(calls.checkDomainVerification, undefined, "should never call Vercel when there's no custom domain to check");
});

test("GET skips the live Vercel check when already verified — trusts the stored value", async () => {
  const { deps, calls } = makeFakeDeps({ store: { id: "store-1", slug: "my-shop", customDomain: "shop.com", customDomainVerified: true } });
  const res = await handleGetDomain(deps, getReq("store-1"));
  const body = await res.json();
  assert.equal(body.customDomainVerified, true);
  assert.equal(calls.checkDomainVerification, undefined);
});

test("GET re-checks live with Vercel when not yet verified, and persists a flip to verified", async () => {
  const { deps, calls } = makeFakeDeps({
    store: { id: "store-1", slug: "my-shop", customDomain: "shop.com", customDomainVerified: false },
    checkResult: { ok: true, verified: true },
  });
  const res = await handleGetDomain(deps, getReq("store-1"));
  const body = await res.json();
  assert.equal(calls.checkDomainVerification, "shop.com");
  assert.equal(body.customDomainVerified, true);
  assert.equal((calls.update as any).data.customDomainVerified, true);
});

test("POST rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps({});
  const res = await handleSetDomain(deps, noTokenReq());
  assert.equal(res.status, 401);
});

test("POST rejects an invalid domain shape with 400", async () => {
  const { deps } = makeFakeDeps({ store: { id: "store-1", slug: "s", customDomain: null, customDomainVerified: false } });
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: "not a domain!!" }));
  assert.equal(res.status, 400);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { deps } = makeFakeDeps({});
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: "shop.com" }));
  assert.equal(res.status, 403);
});

test("POST with customDomain:null clears the domain and calls removeDomainFromProject", async () => {
  const { deps, calls } = makeFakeDeps({ store: { id: "store-1", slug: "s", customDomain: "old.com", customDomainVerified: true } });
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: null }));
  assert.equal(res.status, 200);
  assert.equal(calls.removeDomainFromProject, "old.com");
  assert.equal((calls.update as any).data.customDomain, null);
});

test("POST surfaces a Vercel-side rejection (e.g. domain already taken elsewhere) as 400, not a 500", async () => {
  const { deps } = makeFakeDeps({
    store: { id: "store-1", slug: "s", customDomain: null, customDomainVerified: false },
    addResult: { ok: false, error: "domain already in use" },
  });
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: "taken.com" }));
  assert.equal(res.status, 400);
});

test("POST sets a new verified custom domain successfully", async () => {
  const { deps, calls } = makeFakeDeps({
    store: { id: "store-1", slug: "s", customDomain: null, customDomainVerified: false },
    addResult: { ok: true, verified: true },
  });
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: "shop.com" }));
  assert.equal(res.status, 200);
  assert.equal((calls.update as any).data.customDomainVerified, true);
});

test("POST maps a duplicate-domain DB constraint violation to a friendly 409", async () => {
  const { deps } = makeFakeDeps({
    store: { id: "store-1", slug: "s", customDomain: null, customDomainVerified: false },
    addResult: { ok: true, verified: true },
  });
  deps.db.store.update = async () => {
    const err = new Error("dup") as Error & { code: string };
    err.code = "P2002";
    throw err;
  };
  const res = await handleSetDomain(deps, postReq({ storeId: "store-1", customDomain: "shop.com" }));
  assert.equal(res.status, 409);
});
