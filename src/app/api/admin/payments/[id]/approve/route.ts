import { prisma } from "@/lib/prisma";
import { handleApprovePayment } from "./handler";

// POST /api/admin/payments/:id/approve — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleApprovePayment(prisma, req, id);
}
