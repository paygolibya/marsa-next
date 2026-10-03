import { prisma } from "@/lib/prisma";
import { handleInquiriesByStore } from "./handler";

// GET /api/inquiries/by-store/:storeId — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return handleInquiriesByStore(prisma, req, storeId);
}
