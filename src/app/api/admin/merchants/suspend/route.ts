import { prisma } from "@/lib/prisma";
import { handleSuspendMerchant } from "./handler";

// POST /api/admin/merchants/suspend — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleSuspendMerchant(prisma, req);
}
