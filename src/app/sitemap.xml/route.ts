import { prisma } from "@/lib/prisma";
import { buildSitemapXml, classifyHost, originFor, sitemapEntriesFor } from "@/lib/seo/crawl-files";

// Host-aware sitemap — rifqa.ly lists its own marketing pages, each
// storefront host lists that store's products and pages. See
// lib/seo/crawl-files.ts.
export async function GET(req: Request) {
  const host = req.headers.get("host");
  const kind = await classifyHost(prisma, host);
  const entries = await sitemapEntriesFor(prisma, kind);
  return new Response(buildSitemapXml(originFor(host), entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
