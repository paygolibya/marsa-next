import { processRecentDeliveries, withRetry, logCronRun } from "@/lib/payment/payout-processor";
import { handleProcessDeliveries, handleProcessDeliveriesManualTrigger } from "./handler";

const deps = { processRecentDeliveries, withRetry, logCronRun };

// GET/POST /api/cron/process-deliveries — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleProcessDeliveries(deps, req);
}

export async function POST(req: Request) {
  return handleProcessDeliveriesManualTrigger(deps, req);
}
