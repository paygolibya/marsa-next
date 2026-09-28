import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    // Capped as a scale safety net (see admin/orders for the same pattern)
    // — at today's real merchant count this changes nothing; a real
    // paginated/searchable admin merchant list is a separate UI feature.
    const merchants = await prisma.merchant.findMany({
      include: { stores: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return NextResponse.json({ merchants });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return NextResponse.json({ error: "Failed to fetch merchants" }, { status: 500 });
  }
}
