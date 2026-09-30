import { prisma } from "@/lib/prisma";
import { handleImpersonateMerchant } from "./handler";

// POST /api/admin/merchants/impersonate — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleImpersonateMerchant(prisma, req);
}
