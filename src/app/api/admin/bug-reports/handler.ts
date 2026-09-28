import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type BugReportRow = {
  id: string;
  summary: string;
  status: string;
  merchant: { name: string; phone: string };
  conversation: { messages: { role: string; content: string }[] } | null;
};

export type BugReportsDb = {
  bugReport: {
    findMany: (args: {
      include: { merchant: { select: { name: true; phone: true } }; conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } } };
      orderBy: { createdAt: "desc" };
    }) => Promise<BugReportRow[]>;
  };
};

// GET /api/admin/bug-reports — the escalation queue: real platform issues
// the support agent surfaced, for a human developer to review and fix (see
// docs on BugReport in schema.prisma — no agent here auto-deploys a fix).
export async function handleListBugReports(db: BugReportsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const reports = await db.bugReport.findMany({
      include: {
        merchant: { select: { name: true, phone: true } },
        conversation: { include: { messages: { orderBy: { createdAt: "asc" } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Error fetching bug reports:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch bug reports" }, { status: 500 });
  }
}
