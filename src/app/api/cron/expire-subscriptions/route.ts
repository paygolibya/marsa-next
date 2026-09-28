import { withRetry, logCronRun } from "@/lib/payment/payout-processor";
import { expireAllLapsed } from "@/lib/subscription/expire";
import { handleExpireSubscriptions, handleExpireSubscriptionsManualTrigger } from "./handler";

const deps = { expireAllLapsed, withRetry, logCronRun };

// GET/POST /api/cron/expire-subscriptions — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleExpireSubscriptions(deps, req);
}

export async function POST(req: Request) {
  return handleExpireSubscriptionsManualTrigger(deps, req);
}
