import { prisma } from "@/lib/prisma";
import { handleCreateCoupon, handleListCoupons } from "./handler";

// POST/GET /api/coupons — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateCoupon(prisma, req);
}

export async function GET(req: Request) {
  return handleListCoupons(prisma, req);
}
