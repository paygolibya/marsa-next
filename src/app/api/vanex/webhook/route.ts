import { prisma } from "@/lib/prisma";
import { sendOrderStatusEmail } from "@/lib/integrations/email";
import { sendShipmentStatusSms } from "@/lib/integrations/sms";
import { calculateCommissionForOrder } from "@/lib/payment/payout-processor";
import { handleVanexWebhook } from "./handler";

// POST /api/vanex/webhook — Vanex pushes shipment status changes here.
// Auth is a shared secret header, not a merchant/admin token, since Vanex
// itself is the caller.
//
// Unlike the fire-and-forget "respond first, process async" pattern some
// courier docs suggest, we await the DB updates before responding — a
// Vercel serverless function can be frozen immediately after it returns a
// response, which would silently drop any work still in flight.
//
// See handler.ts for the actual logic — it's injectable there so it can be
// integration-tested with fakes (no real DB/email/SMS calls; handler.test.ts).
export async function POST(req: Request) {
  return handleVanexWebhook({ db: prisma, sendOrderStatusEmail, sendShipmentStatusSms, calculateCommissionForOrder }, req);
}
