import { prisma } from "@/lib/prisma";
import { handleCreateProduct } from "./handler";

// POST /api/products — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateProduct(prisma, req);
}
