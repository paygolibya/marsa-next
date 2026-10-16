import { domainToUnicode } from "node:url";

// robots.txt and sitemap.xml are served on every host this app answers
// (rifqa.ly itself, each {slug}.rifqa.ly storefront, and verified custom
// domains) — middleware.ts skips any path with a file extension, so both
// arrive at the same route handlers regardless of host. These helpers
// decide what each host should get: the platform's own pages for
// rifqa.ly, and that one store's pages for a storefront host.

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "rifqa.ly";

export type CrawlFilesDb = {
  store: {
    findUnique: (args: { where: { slug: string }; select: { id: true; slug: true } }) => Promise<{ id: string; slug: string } | null>;
    findFirst: (args: {
      where: { customDomain: string; customDomainVerified: true };
      select: { id: true; slug: true };
    }) => Promise<{ id: string; slug: string } | null>;
  };
  product: {
    findMany: (args: {
      where: { storeId: string; active: true };
      select: { id: true; createdAt: true };
      orderBy: { createdAt: "desc" };
      take: number;
    }) => Promise<{ id: string; createdAt: Date }[]>;
  };
  page: {
    findMany: (args: { where: { storeId: string }; select: { slug: true } }) => Promise<{ slug: string }[]>;
  };
};

export type HostKind = { kind: "platform" } | { kind: "store"; storeId: string } | { kind: "unknown" };

export function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

export async function classifyHost(db: CrawlFilesDb, rawHost: string | null): Promise<HostKind> {
  const host = normalizeHost(rawHost);
  if (!host || host === ROOT_DOMAIN || host === `www.${ROOT_DOMAIN}` || host === "localhost" || host.endsWith(".vercel.app")) {
    return { kind: "platform" };
  }
  if (host.endsWith(`.${ROOT_DOMAIN}`)) {
    const label = host.slice(0, -(ROOT_DOMAIN.length + 1));
    const slug = label.startsWith("xn--") ? domainToUnicode(label) : label;
    const store = await db.store.findUnique({ where: { slug }, select: { id: true, slug: true } });
    return store ? { kind: "store", storeId: store.id } : { kind: "unknown" };
  }
  const store = await db.store.findFirst({ where: { customDomain: host, customDomainVerified: true }, select: { id: true, slug: true } });
  return store ? { kind: "store", storeId: store.id } : { kind: "unknown" };
}

// Private areas stay out of search results; everything a shopper or a
// prospective merchant would search for stays crawlable.
const PLATFORM_DISALLOW = ["/dashboard", "/admin", "/api/", "/onboarding", "/verify-phone", "/payment", "/pay/", "/subscription"];
const STORE_DISALLOW = ["/checkout", "/confirmation", "/track", "/api/"];

export function buildRobotsTxt(origin: string, kind: HostKind): string {
  if (kind.kind === "unknown") return "User-agent: *\nDisallow: /\n";
  const disallow = kind.kind === "platform" ? PLATFORM_DISALLOW : STORE_DISALLOW;
  return ["User-agent: *", "Allow: /", ...disallow.map((p) => `Disallow: ${p}`), "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
}

export type SitemapEntry = { path: string; lastModified?: Date; priority?: number };

const PLATFORM_PAGES: SitemapEntry[] = [
  { path: "/", priority: 1 },
  { path: "/register", priority: 0.8 },
  { path: "/login", priority: 0.5 },
  { path: "/cookies", priority: 0.2 },
];

// Google's per-file cap is 50,000 URLs; no store is anywhere near that,
// but the cap keeps one runaway catalogue from producing a huge response.
const MAX_PRODUCTS = 5000;

export async function sitemapEntriesFor(db: CrawlFilesDb, kind: HostKind): Promise<SitemapEntry[]> {
  if (kind.kind === "platform") return PLATFORM_PAGES;
  if (kind.kind === "unknown") return [];
  const [products, pages] = await Promise.all([
    db.product.findMany({
      where: { storeId: kind.storeId, active: true },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: MAX_PRODUCTS,
    }),
    db.page.findMany({ where: { storeId: kind.storeId }, select: { slug: true } }),
  ]);
  return [
    { path: "/", priority: 1 },
    ...products.map((p) => ({ path: `/product/${p.id}`, lastModified: p.createdAt, priority: 0.8 })),
    ...pages.map((p) => ({ path: `/page/${encodeURIComponent(p.slug)}`, priority: 0.4 })),
  ];
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function buildSitemapXml(origin: string, entries: SitemapEntry[]): string {
  const urls = entries.map((e) => {
    const parts = [`<loc>${escapeXml(origin + e.path)}</loc>`];
    if (e.lastModified) parts.push(`<lastmod>${e.lastModified.toISOString()}</lastmod>`);
    if (e.priority !== undefined) parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
    return `  <url>${parts.join("")}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

// Always https in production; the request's own protocol is only trusted
// for localhost (Vercel terminates TLS, so req.url may say http).
export function originFor(rawHost: string | null): string {
  const host = (rawHost ?? "").toLowerCase() || ROOT_DOMAIN;
  return host.startsWith("localhost") ? `http://${host}` : `https://${host}`;
}
