import { prisma } from "@/lib/prisma";
import { isAdminMerchantId } from "@/lib/auth";
import { handleListDriverOrders } from "./handler";

// GET /api/driver/orders — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function GET(req: Request) {
  return handleListDriverOrders({ db: prisma, isDriver: isAdminMerchantId }, req);
}
