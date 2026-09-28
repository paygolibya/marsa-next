import test from "node:test";
import assert from "node:assert/strict";
import { handleResolveDomain, type ResolveDomainDb } from "./handler";

function req(host: string | null) {
  const url = new URL("http://localhost/api/internal/resolve-domain");
  if (host) url.searchParams.set("host", host);
  return new Request(url);
}

test("returns slug:null with no host param, without querying the database", async () => {
  let queried = false;
  const db: ResolveDomainDb = { store: { findFirst: async () => { queried = true; return null; } } };
  const res = await handleResolveDomain(db, req(null));
  const body = await res.json();
  assert.deepEqual(body, { slug: null });
  assert.equal(queried, false);
});

test("only resolves a verified custom domain — the actual security property this route enforces", async () => {
  let receivedWhere: unknown;
  const db: ResolveDomainDb = {
    store: {
      findFirst: async (args) => {
        receivedWhere = args.where;
        return null;
      },
    },
  };
  await handleResolveDomain(db, req("shop.com"));
  assert.deepEqual(receivedWhere, { customDomain: "shop.com", customDomainVerified: true });
});

test("lowercases the host before looking it up", async () => {
  let receivedWhere: unknown;
  const db: ResolveDomainDb = {
    store: {
      findFirst: async (args) => {
        receivedWhere = args.where;
        return null;
      },
    },
  };
  await handleResolveDomain(db, req("SHOP.COM"));
  assert.equal((receivedWhere as any).customDomain, "shop.com");
});

test("returns the real slug for a matching verified domain", async () => {
  const db: ResolveDomainDb = { store: { findFirst: async () => ({ slug: "my-shop" }) } };
  const res = await handleResolveDomain(db, req("shop.com"));
  const body = await res.json();
  assert.equal(body.slug, "my-shop");
});
