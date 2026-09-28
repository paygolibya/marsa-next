import { prisma } from "@/lib/prisma";
import { handleDeleteMerchant } from "./handler";

// DELETE /api/admin/merchants/delete — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function DELETE(req: Request) {
  return handleDeleteMerchant(prisma, req);
}
