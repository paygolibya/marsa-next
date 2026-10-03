import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleGetAvailability } from "./handler";

// GET /api/stores/public/:slug/availability — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleGetAvailability(prisma, req, slug);
}
