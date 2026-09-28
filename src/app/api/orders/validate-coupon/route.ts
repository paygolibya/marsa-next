import { prisma } from "@/lib/prisma";
import { handleValidateCoupon } from "./handler";

// POST /api/orders/validate-coupon — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleValidateCoupon(prisma, req);
}
