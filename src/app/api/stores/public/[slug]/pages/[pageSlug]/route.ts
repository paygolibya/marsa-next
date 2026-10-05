import { prisma } from "@/lib/prisma";
import { handleGetPublicPage } from "./handler";

// GET /api/stores/public/:slug/pages/:pageSlug — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; pageSlug: string }> }) {
  const { slug, pageSlug } = await params;
  return handleGetPublicPage(prisma, slug, pageSlug);
}
