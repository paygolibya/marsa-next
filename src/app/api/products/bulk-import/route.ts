import { prisma } from "@/lib/prisma";
import { handleBulkImport } from "./handler";

// POST /api/products/bulk-import — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleBulkImport(prisma, req);
}
