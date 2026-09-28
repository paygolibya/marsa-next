import { prisma } from "@/lib/prisma";
import { handleGetTemplate } from "./handler";

// GET /api/templates/:slug — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleGetTemplate(prisma, slug);
}
