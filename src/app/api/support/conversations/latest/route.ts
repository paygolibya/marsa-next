import { prisma } from "@/lib/prisma";
import { handleLatestConversation } from "./handler";

// GET /api/support/conversations/latest — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleLatestConversation(prisma, req);
}
