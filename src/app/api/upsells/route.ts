import { prisma } from "@/lib/prisma";
import { handleCreateUpsell, handleListUpsells } from "./handler";

// POST /api/upsells, GET /api/upsells?storeId=... — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateUpsell(prisma, req);
}
export async function GET(req: Request) {
  return handleListUpsells(prisma, req);
}
