import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

// GET /api/stores/mine — a merchant's own stores (needs auth).
// Ported from marsa-backend/src/routes/stores.js (GET /mine).
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const stores = await prisma.store.findMany({
      where: { merchantId },
      include: { customization: { include: { template: true } } },
    });
    return NextResponse.json(stores);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
