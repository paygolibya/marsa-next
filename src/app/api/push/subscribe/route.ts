import { prisma } from "@/lib/prisma";
import { handlePushSubscribe } from "./handler";

// POST /api/push/subscribe — see handler.ts (injectable there so it can be
// integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handlePushSubscribe(prisma, req);
}
