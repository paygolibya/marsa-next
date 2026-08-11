import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { syncVanexCities } from "@/lib/integrations/vanex";

// POST /api/admin/vanex/sync-cities — pulls the current city/area price
// list from Vanex and upserts it locally (by vanexId, never delete+recreate
// — existing orders may reference a VanexArea via their vanexAreaId).
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncVanexCities();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Vanex city sync failed:", error);
    return NextResponse.json({ error: "فشل مزامنة المدن مع Vanex" }, { status: 500 });
  }
}
