import { prisma } from "@/lib/prisma";
import { handleListOrders } from "./handler";

// GET /api/admin/orders — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleListOrders(prisma, req);
}
