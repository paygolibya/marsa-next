import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleRefund } from "./handler";

// POST /api/orders/:id/refund — merchant-scoped (their own store's order
// only, same ownership pattern as every other order/store route). See
// handler.ts for the actual logic — it's injectable there so it can be
// integration-tested with a fake Prisma client (handler.test.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleRefund(prisma, req, id);
}
