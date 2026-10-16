import test from "node:test";
import assert from "node:assert/strict";
import { buildRobotsTxt, buildSitemapXml, classifyHost, originFor, sitemapEntriesFor, type CrawlFilesDb } from "./crawl-files";

function fakeDb(stores: { id: string; slug: string; customDomain?: string }[]): CrawlFilesDb {
  return {
    store: {
      findUnique: async ({ where }) => stores.find((s) => s.slug === where.slug) ?? null,
      findFirst: async ({ where }) => stores.find((s) => s.customDomain === where.customDomain) ?? null,
    },
    product: {
      findMany: async ({ where }) => (where.storeId === "s1" ? [{ id: "p1", createdAt: new Date("2026-10-01T00:00:00Z") }] : []),
    },
    page: { findMany: async () => [{ slug: "من-نحن" }] },
  };
}

test("rifqa.ly, www, vercel.app and localhost are the platform", async () => {
  const db = fakeDb([]);
  for (const host of ["rifqa.ly", "www.rifqa.ly", "marsa-next.vercel.app", "localhost:3000"]) {
    assert.deepEqual(await classifyHost(db, host), { kind: "platform" });
  }
});

test("a store subdomain, punycode subdomain and verified custom domain resolve to the store", async () => {
  const db = fakeDb([
    { id: "s1", slug: "shop" },
    { id: "s2", slug: "متجر" },
    { id: "s3", slug: "x", customDomain: "myshop.com" },
  ]);
  assert.deepEqual(await classifyHost(db, "shop.rifqa.ly"), { kind: "store", storeId: "s1" });
  assert.deepEqual(await classifyHost(db, "xn--pgbep1f.rifqa.ly"), { kind: "store", storeId: "s2" });
  assert.deepEqual(await classifyHost(db, "MyShop.com"), { kind: "store", storeId: "s3" });
  assert.deepEqual(await classifyHost(db, "nope.rifqa.ly"), { kind: "unknown" });
});

test("platform robots hides private areas and points to its sitemap", () => {
  const txt = buildRobotsTxt("https://rifqa.ly", { kind: "platform" });
  assert.match(txt, /Disallow: \/dashboard/);
  assert.match(txt, /Disallow: \/admin/);
  assert.match(txt, /Sitemap: https:\/\/rifqa\.ly\/sitemap\.xml/);
});

test("store robots hides checkout but not products; unknown hosts are fully disallowed", () => {
  const txt = buildRobotsTxt("https://shop.rifqa.ly", { kind: "store", storeId: "s1" });
  assert.match(txt, /Disallow: \/checkout/);
  assert.doesNotMatch(txt, /Disallow: \/product/);
  assert.equal(buildRobotsTxt("https://x", { kind: "unknown" }), "User-agent: *\nDisallow: /\n");
});

test("store sitemap lists home, active products and pages, with escaped/encoded URLs", async () => {
  const db = fakeDb([{ id: "s1", slug: "shop" }]);
  const entries = await sitemapEntriesFor(db, { kind: "store", storeId: "s1" });
  const xml = buildSitemapXml("https://shop.rifqa.ly", entries);
  assert.match(xml, /<loc>https:\/\/shop\.rifqa\.ly\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/shop\.rifqa\.ly\/product\/p1<\/loc><lastmod>2026-10-01T00:00:00\.000Z<\/lastmod>/);
  assert.match(xml, /\/page\/%D9%85/);
});

test("platform sitemap lists the public marketing pages only", async () => {
  const entries = await sitemapEntriesFor(fakeDb([]), { kind: "platform" });
  const paths = entries.map((e) => e.path);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/register"));
  assert.ok(!paths.some((p) => p.startsWith("/dashboard")));
});

test("origin is https except on localhost", () => {
  assert.equal(originFor("shop.rifqa.ly"), "https://shop.rifqa.ly");
  assert.equal(originFor("localhost:3000"), "http://localhost:3000");
  assert.equal(originFor(null), "https://rifqa.ly");
});
