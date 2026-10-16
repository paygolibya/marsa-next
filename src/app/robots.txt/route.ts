import { prisma } from "@/lib/prisma";
import { buildRobotsTxt, classifyHost, originFor } from "@/lib/seo/crawl-files";

// Host-aware robots.txt — see lib/seo/crawl-files.ts.
export async function GET(req: Request) {
  const host = req.headers.get("host");
  const kind = await classifyHost(prisma, host);
  return new Response(buildRobotsTxt(originFor(host), kind), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
