import { prisma } from "@/lib/prisma";
import { openDpaySession } from "@/lib/payment/dpay-client";
import { createShipment } from "@/lib/integrations/couriers";
import { sendOrderConfirmationEmail } from "@/lib/integrations/email";
import { sendNewOrderSms } from "@/lib/integrations/sms";
import { handleCreateOrder } from "./handler";

// POST /api/orders — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function POST(req: Request) {
  return handleCreateOrder({ db: prisma, openDpaySession, createShipment, sendOrderConfirmationEmail, sendNewOrderSms }, req);
}
