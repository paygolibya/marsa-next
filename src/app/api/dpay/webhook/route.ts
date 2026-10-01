import { prisma } from "@/lib/prisma";
import { finalizeByMerchantReference } from "@/lib/payment/dpay-dispatch";
import { handleDpayWebhook } from "./handler";

// POST /api/dpay/webhook — see handler.ts for the actual logic (it's
// injectable there so it can be integration-tested with fakes;
// handler.test.ts — no real DB/DPay calls).
export async function POST(req: Request) {
  return handleDpayWebhook({ db: prisma, finalizeByMerchantReference }, req);
}
