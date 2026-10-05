import { prisma } from "@/lib/prisma";
import { handleCreatePage, handleListPages } from "./handler";

// POST /api/pages, GET /api/pages?storeId=... — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreatePage(prisma, req);
}
export async function GET(req: Request) {
  return handleListPages(prisma, req);
}
