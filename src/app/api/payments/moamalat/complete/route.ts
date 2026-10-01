import { prisma } from "@/lib/prisma";
import { finalizeByMerchantReference } from "@/lib/payment/moamalat-dispatch";
import { handleMoamalatComplete } from "./handler";

// POST /api/payments/moamalat/complete — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleMoamalatComplete({ db: prisma, finalizeByMerchantReference }, req);
}
