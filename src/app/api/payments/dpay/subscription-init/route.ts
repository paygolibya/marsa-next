import { prisma } from "@/lib/prisma";
import { openDpaySession } from "@/lib/payment/dpay-client";
import { handleSubscriptionInit } from "./handler";

// POST /api/payments/dpay/subscription-init — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleSubscriptionInit({ db: prisma, openDpaySession }, req);
}
