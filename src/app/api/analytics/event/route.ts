import { prisma } from "@/lib/prisma";
import { handleCreateAnalyticsEvent } from "./handler";

// POST /api/analytics/event — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleCreateAnalyticsEvent(prisma, req);
}
