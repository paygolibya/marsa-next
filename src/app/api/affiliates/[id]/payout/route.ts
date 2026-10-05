import { prisma } from "@/lib/prisma";
import { handleCreateAffiliatePayout } from "./handler";

// POST /api/affiliates/:id/payout — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleCreateAffiliatePayout(prisma, req, id);
}
