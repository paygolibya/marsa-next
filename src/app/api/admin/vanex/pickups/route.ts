import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { listVanexPickups, requestVanexPickup } from "@/lib/integrations/vanex";

// GET /api/admin/vanex/pickups?status=1|2|3 — list pending/completed/cancelled
// pickup requests on the platform's single shared Vanex account.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = Number(url.searchParams.get("status") || "1") as 1 | 2 | 3;

  try {
    const pickups = await listVanexPickups(status);
    return NextResponse.json({ pickups });
  } catch (error) {
    console.error("Failed to list Vanex pickups:", error);
    return NextResponse.json({ error: "فشل جلب طلبات الاستلام" }, { status: 500 });
  }
}

// POST /api/admin/vanex/pickups — request a courier pickup.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { phone, backupPhone, numberOfPackages, address, mapUrl, notes, services } = body;
    if (!phone || !numberOfPackages || !address || !mapUrl) {
      return NextResponse.json({ error: "الهاتف والعنوان ورابط الموقع وعدد الطرود مطلوبة" }, { status: 400 });
    }

    const result = await requestVanexPickup({ phone, backupPhone, numberOfPackages, address, mapUrl, notes, services });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to request Vanex pickup:", error);
    return NextResponse.json({ error: "فشل طلب الاستلام" }, { status: 500 });
  }
}
