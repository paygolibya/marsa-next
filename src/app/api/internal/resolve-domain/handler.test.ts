import test from "node:test";
import assert from "node:assert/strict";
import { domainToASCII } from "node:url";
import { handleResolveDomain, type ResolveDomainDb } from "./handler";

process.env.ROOT_DOMAIN = "rifqa.ly";

function req(host: string | null) {
  const url = new URL("http://localhost/api/internal/resolve-domain");
  if (host) url.searchParams.set("host", host);
  return new Request(url);
}

function makeDb(opts: { findFirstResult?: { slug: string } | null; findUniqueResult?: { slug: string } | null } = {}) {
  const calls: { findFirstWhere?: unknown; findUniqueWhere?: unknown } = {};
  const db: ResolveDomainDb = {
    store: {
      findFirst: async (args) => {
        calls.findFirstWhere = args.where;
        return opts.findFirstResult ?? null;
      },
      findUnique: async (args) => {
        calls.findUniqueWhere = args.where;
        return opts.findUniqueResult ?? null;
      },
    },
  };
  return { db, calls };
}

test("returns slug:null with no host param, without querying the database", async () => {
  const { db, calls } = makeDb();
  const res = await handleResolveDomain(db, req(null));
  const body = await res.json();
  assert.deepEqual(body, { slug: null });
  assert.equal(calls.findFirstWhere, undefined);
  assert.equal(calls.findUniqueWhere, undefined);
});

test("only resolves a verified custom domain — the actual security property this route enforces", async () => {
  const { db, calls } = makeDb();
  await handleResolveDomain(db, req("shop.com"));
  assert.deepEqual(calls.findFirstWhere, { customDomain: "shop.com", customDomainVerified: true });
});

test("lowercases the host before looking it up", async () => {
  const { db, calls } = makeDb();
  await handleResolveDomain(db, req("SHOP.COM"));
  assert.equal((calls.findFirstWhere as any).customDomain, "shop.com");
});

test("returns the real slug for a matching verified domain", async () => {
  const { db } = makeDb({ findFirstResult: { slug: "my-shop" } });
  const res = await handleResolveDomain(db, req("shop.com"));
  const body = await res.json();
  assert.equal(body.slug, "my-shop");
});

// An Arabic (or any non-ASCII) store slug — browsers always send an IDN
// subdomain's Host header punycode-encoded, never as the original
// Unicode text (confirmed against a real browser's URL parser). This is
// the actual bug this route update fixes: a fresh store with an Arabic
// name's subdomain never resolved before this.
test("decodes a punycode rifqa.ly subdomain back to the real Unicode slug before looking it up", async () => {
  const realSlug = "متجر-تجريبي";
  // Computed the same way a real browser computes it for the Host header
  // of https://متجر-تجريبي.rifqa.ly — not hand-transcribed (easy to get
  // a punycode string wrong by hand).
  const punycodeLabel = domainToASCII(realSlug);
  assert.ok(punycodeLabel.startsWith("xn--"), "sanity check: this slug should actually need punycode encoding");

  const { db, calls } = makeDb({ findUniqueResult: { slug: realSlug } });
  const res = await handleResolveDomain(db, req(`${punycodeLabel}.rifqa.ly`));

  assert.deepEqual(calls.findUniqueWhere, { slug: realSlug });
  assert.equal(calls.findFirstWhere, undefined);
  const body = await res.json();
  assert.equal(body.slug, realSlug);
});

test("a non-punycode, non-custom-domain rifqa.ly subdomain resolves to null — middleware's own fast path handles plain ASCII slugs, never this route", async () => {
  const { db, calls } = makeDb();
  const res = await handleResolveDomain(db, req("plain-ascii-slug.rifqa.ly"));
  const body = await res.json();
  assert.equal(body.slug, null);
  assert.equal(calls.findUniqueWhere, undefined);
  assert.equal(calls.findFirstWhere, undefined);
});

test("rejects whatever the DB doesn't recognize, even for a well-formed punycode subdomain", async () => {
  const { db } = makeDb({ findUniqueResult: null });
  const res = await handleResolveDomain(db, req("xn--mgbcd0eb.rifqa.ly"));
  const body = await res.json();
  assert.equal(body.slug, null);
});
