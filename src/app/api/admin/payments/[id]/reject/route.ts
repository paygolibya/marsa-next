import { prisma } from "@/lib/prisma";
import { handleRejectPayment } from "./handler";

// POST /api/admin/payments/:id/reject — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRejectPayment(prisma, req, id);
}
