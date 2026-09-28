import { prisma } from "@/lib/prisma";
import { handleAdminStats } from "./handler";

// GET /api/admin/stats — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleAdminStats(prisma, req);
}
