import { prisma } from "@/lib/prisma";
import { handleSubscriptionInit } from "./handler";

// POST /api/payments/moamalat/subscription-init — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleSubscriptionInit(prisma, req);
}
