import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewInquirySms } from "@/lib/integrations/sms";
import { handleCreateInquiry } from "./handler";

// POST /api/inquiries — see handler.ts for the actual logic (injectable
// there so it can be integration-tested with fakes; handler.test.ts).
export async function POST(req: NextRequest) {
  return handleCreateInquiry({ db: prisma, sendNewInquirySms }, req);
}
