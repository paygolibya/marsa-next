import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleCustomizeGet, handleCustomizePost } from "./handler";

// POST/GET /api/stores/:id/customize — needs auth + ownership. See
// handler.ts for the actual logic — it's injectable there so it can be
// integration-tested with a fake Prisma client (handler.test.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleCustomizePost(prisma, req, id);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleCustomizeGet(prisma, req, id);
}
