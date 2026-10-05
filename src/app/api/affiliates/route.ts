import { prisma } from "@/lib/prisma";
import { handleCreateAffiliate, handleListAffiliates } from "./handler";

// POST /api/affiliates, GET /api/affiliates?storeId=... — see handler.ts
// for the actual logic (injectable there so it can be
// integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateAffiliate(prisma, req);
}
export async function GET(req: Request) {
  return handleListAffiliates(prisma, req);
}
