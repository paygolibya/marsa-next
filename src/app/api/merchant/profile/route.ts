import { prisma } from "@/lib/prisma";
import { handleUpdateMerchantProfile } from "./handler";

// PATCH /api/merchant/profile — see handler.ts (injectable there so it can
// be integration-tested with fakes; handler.test.ts).
export async function PATCH(req: Request) {
  return handleUpdateMerchantProfile(prisma, req);
}
