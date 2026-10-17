import { prisma } from "@/lib/prisma";
import { isAdminMerchantId } from "@/lib/auth";
import { sendOrderStatusEmail } from "@/lib/integrations/email";
import { sendShipmentStatusSms } from "@/lib/integrations/sms";
import { calculateCommissionForOrder } from "@/lib/payment/payout-processor";
import { handleUpdateDriverStatus } from "./handler";

// POST /api/driver/orders/:id/status — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleUpdateDriverStatus(
    { db: prisma, isDriver: isAdminMerchantId, sendOrderStatusEmail, sendShipmentStatusSms, calculateCommissionForOrder },
    req,
    id
  );
}
