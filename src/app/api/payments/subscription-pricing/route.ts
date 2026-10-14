import { prisma } from "@/lib/prisma";
import { handleSubscriptionPricing } from "./handler";

// GET /api/payments/subscription-pricing — see handler.ts.
export async function GET(req: Request) {
  return handleSubscriptionPricing(prisma, req);
}
