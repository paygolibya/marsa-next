import { prisma } from "@/lib/prisma";
import { handleListPayments } from "./handler";

// GET /api/admin/payments — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleListPayments(prisma, req);
}
