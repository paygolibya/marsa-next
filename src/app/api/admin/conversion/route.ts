import { prisma } from "@/lib/prisma";
import { isAdminMerchantId } from "@/lib/auth";
import { handleConversion } from "./handler";

// GET /api/admin/conversion — see handler.ts.
export async function GET(req: Request) {
  return handleConversion({ db: prisma, isAdmin: isAdminMerchantId }, req);
}
