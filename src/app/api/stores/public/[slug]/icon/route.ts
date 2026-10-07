import { prisma } from "@/lib/prisma";
import { handleGetStoreIcon } from "./handler";

// GET /api/stores/public/:slug/icon — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts). Needs the real Node.js runtime (not Edge) for sharp.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams } = new URL(req.url);
  return handleGetStoreIcon(prisma, slug, searchParams);
}
