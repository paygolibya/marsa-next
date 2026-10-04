import { prisma } from "@/lib/prisma";
import { handleCreateBundle, handleListBundles } from "./handler";

// POST /api/bundles, GET /api/bundles?storeId=... — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateBundle(prisma, req);
}
export async function GET(req: Request) {
  return handleListBundles(prisma, req);
}
