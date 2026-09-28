import { prisma } from "@/lib/prisma";
import { handleCreateStore } from "./handler";

// POST /api/stores — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateStore(prisma, req);
}
