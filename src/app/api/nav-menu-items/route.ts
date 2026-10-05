import { prisma } from "@/lib/prisma";
import { handleCreateNavMenuItem, handleListNavMenuItems } from "./handler";

// POST /api/nav-menu-items, GET /api/nav-menu-items?storeId=... — see
// handler.ts for the actual logic (injectable there so it can be
// integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateNavMenuItem(prisma, req);
}
export async function GET(req: Request) {
  return handleListNavMenuItems(prisma, req);
}
