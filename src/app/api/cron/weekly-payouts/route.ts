import { runWeeklyPayoutBatching, withRetry, logCronRun } from "@/lib/payment/payout-processor";
import { handleWeeklyPayouts, handleWeeklyPayoutsManualTrigger } from "./handler";

const deps = { runWeeklyPayoutBatching, withRetry, logCronRun };

// GET/POST /api/cron/weekly-payouts — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleWeeklyPayouts(deps, req);
}

export async function POST(req: Request) {
  return handleWeeklyPayoutsManualTrigger(deps, req);
}
