import { prisma } from "@/lib/prisma";
import { handleGetManifest } from "./handler";

// GET /api/stores/public/:slug/manifest — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleGetManifest(prisma, slug);
}
