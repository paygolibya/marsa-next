import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

// GET /api/admin/bug-reports — the escalation queue: real platform issues
// the support agent surfaced, for a human developer to review and fix (see
// docs on BugReport in schema.prisma — no agent here auto-deploys a fix).
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const reports = await prisma.bugReport.findMany({
      include: {
        merchant: { select: { name: true, phone: true } },
        conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    return NextResponse.json({ error: "Failed to fetch bug reports" }, { status: 500 });
  }
}
