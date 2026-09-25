import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

const VALID_STATUSES = ["open", "investigating", "fixed", "wont_fix"];

// PATCH /api/admin/bug-reports/:id — { status } only, for now.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    if (!VALID_STATUSES.includes(body?.status)) {
      return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    }
    const report = await prisma.bugReport.update({ where: { id }, data: { status: body.status } });
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Error updating bug report:", error);
    return NextResponse.json({ error: "Failed to update bug report" }, { status: 500 });
  }
}
