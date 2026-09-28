import { prisma } from "@/lib/prisma";
import { requestOtpPin } from "@/lib/integrations/sms";
import { handleRegister } from "./handler";

// POST /api/auth/register — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleRegister({ db: prisma, requestOtpPin }, req);
}
