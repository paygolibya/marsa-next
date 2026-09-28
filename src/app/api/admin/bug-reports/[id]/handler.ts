import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

const VALID_STATUSES = ["open", "investigating", "fixed", "wont_fix"];

export type BugReportUpdateDb = {
  bugReport: { update: (args: { where: { id: string }; data: { status: string } }) => Promise<{ id: string; status: string }> };
};

// PATCH /api/admin/bug-reports/:id — { status } only, for now.
export async function handleUpdateBugReport(db: BugReportUpdateDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (!VALID_STATUSES.includes(body?.status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    const report = await db.bugReport.update({ where: { id }, data: { status: body.status } });
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error updating bug report:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to update bug report" }, { status: 500 });
  }
}
