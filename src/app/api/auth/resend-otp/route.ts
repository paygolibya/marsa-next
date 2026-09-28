import { prisma } from "@/lib/prisma";
import { requestOtpPin } from "@/lib/integrations/sms";
import { handleResendOtp } from "./handler";

// POST /api/auth/resend-otp — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleResendOtp({ db: prisma, requestOtpPin }, req);
}
