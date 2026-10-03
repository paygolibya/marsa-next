import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleMarkInquiryHandled } from "./handler";

// PATCH /api/inquiries/:id — mark an inquiry handled; merchant-scoped. See
// handler.ts for the actual logic (injectable there so it can be
// integration-tested with fakes; handler.test.ts).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleMarkInquiryHandled(prisma, req, id);
}
