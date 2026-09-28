import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    // Capped rather than unbounded — this was a full, unlimited findMany
    // across every order on the platform with no take at all; harmless
    // today at current volumes, but a real scale risk as order counts grow.
    // Most-recent-first with a cap covers the actual admin use case (recent
    // activity); a real paginated view is a separate, larger UI feature.
    const orders = await prisma.order.findMany({
      include: { store: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
