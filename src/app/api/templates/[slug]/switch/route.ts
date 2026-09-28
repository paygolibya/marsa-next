import { prisma } from "@/lib/prisma";
import { handleSwitchTemplate } from "./handler";

// POST /api/templates/:slug/switch — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleSwitchTemplate(prisma, req, slug);
}
