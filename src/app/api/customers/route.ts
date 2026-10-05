import { prisma } from "@/lib/prisma";
import { handleListCustomers } from "./handler";

// GET /api/customers?storeId=... — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request) {
  return handleListCustomers(prisma, req);
}
