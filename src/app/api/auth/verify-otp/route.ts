import { prisma } from "@/lib/prisma";
import { handleVerifyOtp } from "./handler";

// POST /api/auth/verify-otp — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request) {
  return handleVerifyOtp(prisma, req);
}
