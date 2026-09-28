import { prisma } from "@/lib/prisma";
import { finalizeByMerchantReference } from "@/lib/payment/moamalat-dispatch";
import { handleMoamalatWebhook } from "./handler";

// POST /api/moamalat/webhook — see handler.ts for the actual logic (it's
// injectable there so it can be integration-tested with fakes;
// handler.test.ts — no real DB/Moamalat calls).
export async function POST(req: Request) {
  return handleMoamalatWebhook({ db: prisma, finalizeByMerchantReference }, req);
}
