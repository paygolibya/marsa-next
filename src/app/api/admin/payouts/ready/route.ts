import { prisma } from "@/lib/prisma";
import { handlePayoutsReady } from "./handler";

// GET /api/admin/payouts/ready — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts). Two thin wrappers instead of passing prisma.payout
// directly — see handler.ts's PayoutsReadyDb comment for why.
export async function GET(req: Request) {
  return handlePayoutsReady(
    {
      payout: {
        findManyWithMerchant: (args) => prisma.payout.findMany(args),
        findManyStatsOnly: (args) => prisma.payout.findMany(args),
      },
    },
    req
  );
}
