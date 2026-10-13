import { prisma } from "@/lib/prisma";
import { handlePushUnsubscribe } from "./handler";

// POST /api/push/unsubscribe — see handler.ts (injectable there so it can
// be integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handlePushUnsubscribe(prisma, req);
}
