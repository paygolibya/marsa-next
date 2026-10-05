import test from "node:test";
import assert from "node:assert/strict";
import { domainToASCII } from "node:url";
import { handleResolveDomain, type ResolveDomainDb } from "./handler";

process.env.ROOT_DOMAIN = "rifqa.ly";

function req(host: string | null, path?: string) {
  const url = new URL("http://localhost/api/internal/resolve-domain");
  if (host) url.searchParams.set("host", host);
  if (path) url.searchParams.set("path", path);
  return new Request(url);
}

function makeDb(
  opts: {
    findFirstResult?: { id: string; slug: string } | null;
    findUniqueResult?: { id: string; slug: string } | null;
    redirectResult?: { toPath: string } | null;
  } = {}
) {
  const calls: { findFirstWhere?: unknown; findUniqueWhere?: unknown; redirectWhere?: unknown } = {};
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
    redirect: {
      findUnique: async (args) => {
        calls.redirectWhere = args.where;
        return opts.redirectResult ?? null;
      },
    },
  };
  return { db, calls };
}

test("returns slug:null, redirectTo:null with no host param, without querying the database", async () => {
  const { db, calls } = makeDb();
  const res = await handleResolveDomain(db, req(null));
  const body = await res.json();
  assert.deepEqual(body, { slug: null, redirectTo: null });
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
  const { db } = makeDb({ findFirstResult: { id: "store-1", slug: "my-shop" } });
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

  const { db, calls } = makeDb({ findUniqueResult: { id: "store-1", slug: realSlug } });
  const res = await handleResolveDomain(db, req(`${punycodeLabel}.rifqa.ly`));

  assert.deepEqual(calls.findUniqueWhere, { slug: realSlug });
  assert.equal(calls.findFirstWhere, undefined);
  const body = await res.json();
  assert.equal(body.slug, realSlug);
});

// Unlike before redirects existed, a plain ASCII subdomain now DOES
// resolve here too — middleware's own fast path still never uses this
// call's slug for that case (it already has it for free), but it still
// calls this route to check for a configured Redirect, which needs the
// store's real id.
test("a plain ASCII rifqa.ly subdomain also resolves (needed for the redirect lookup, even though middleware ignores this slug)", async () => {
  const { db, calls } = makeDb({ findUniqueResult: { id: "store-1", slug: "plain-ascii-slug" } });
  const res = await handleResolveDomain(db, req("plain-ascii-slug.rifqa.ly"));
  const body = await res.json();
  assert.equal(body.slug, "plain-ascii-slug");
  assert.deepEqual(calls.findUniqueWhere, { slug: "plain-ascii-slug" });
});

test("rejects whatever the DB doesn't recognize, even for a well-formed punycode subdomain", async () => {
  const { db } = makeDb({ findUniqueResult: null });
  const res = await handleResolveDomain(db, req("xn--mgbcd0eb.rifqa.ly"));
  const body = await res.json();
  assert.equal(body.slug, null);
  assert.equal(body.redirectTo, null);
});

test("without a path param, never checks for a redirect even when the store resolves", async () => {
  const { db, calls } = makeDb({ findUniqueResult: { id: "store-1", slug: "my-shop" } });
  const res = await handleResolveDomain(db, req("my-shop.rifqa.ly"));
  const body = await res.json();
  assert.equal(body.redirectTo, null);
  assert.equal(calls.redirectWhere, undefined);
});

test("with a path param, looks up a Redirect for (storeId, path) and returns its toPath", async () => {
  const { db, calls } = makeDb({ findUniqueResult: { id: "store-1", slug: "my-shop" }, redirectResult: { toPath: "/page/new-about" } });
  const res = await handleResolveDomain(db, req("my-shop.rifqa.ly", "/old-about"));
  const body = await res.json();
  assert.equal(body.redirectTo, "/page/new-about");
  assert.deepEqual(calls.redirectWhere, { storeId_fromPath: { storeId: "store-1", fromPath: "/old-about" } });
});

test("with a path param but no matching redirect, returns redirectTo:null", async () => {
  const { db } = makeDb({ findUniqueResult: { id: "store-1", slug: "my-shop" }, redirectResult: null });
  const res = await handleResolveDomain(db, req("my-shop.rifqa.ly", "/some-path"));
  const body = await res.json();
  assert.equal(body.redirectTo, null);
});

test("a path param is never checked against the DB when the store itself doesn't resolve", async () => {
  const { db, calls } = makeDb({ findFirstResult: null });
  const res = await handleResolveDomain(db, req("unknown-host.com", "/some-path"));
  const body = await res.json();
  assert.equal(body.redirectTo, null);
  assert.equal(calls.redirectWhere, undefined);
});
