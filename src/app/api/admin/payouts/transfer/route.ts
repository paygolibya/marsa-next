import { prisma } from "@/lib/prisma";
import { handleTransferPayout } from "./handler";

// POST /api/admin/payouts/transfer — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleTransferPayout(prisma, req);
}
