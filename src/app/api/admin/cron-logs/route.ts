import { prisma } from "@/lib/prisma";
import { handleCronLogs } from "./handler";

// GET /api/admin/cron-logs — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleCronLogs(prisma, req);
}
