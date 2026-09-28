import { prisma } from "@/lib/prisma";
import { handleAcceptMerchant } from "./handler";

// POST /api/admin/merchants/accept — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleAcceptMerchant(prisma, req);
}
