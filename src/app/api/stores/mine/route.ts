import { prisma } from "@/lib/prisma";
import { handleStoresMine } from "./handler";

// GET /api/stores/mine — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleStoresMine(prisma, req);
}
