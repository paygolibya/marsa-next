import { prisma } from "@/lib/prisma";
import { handleResolveDomain } from "./handler";

// GET /api/internal/resolve-domain — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleResolveDomain(prisma, req);
}
