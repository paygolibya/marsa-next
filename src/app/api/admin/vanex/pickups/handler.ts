import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import type { VanexPickupInput } from "@/lib/integrations/vanex";

export type VanexPickupsDeps = {
  listVanexPickups: (status: 1 | 2 | 3) => Promise<unknown>;
  requestVanexPickup: (input: VanexPickupInput) => Promise<unknown>;
};

// GET /api/admin/vanex/pickups?status=1|2|3 — list pending/completed/cancelled
// pickup requests on the platform's single shared Vanex account.
export async function handleListVanexPickups(deps: VanexPickupsDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = Number(url.searchParams.get("status") || "1") as 1 | 2 | 3;

  try {
    const pickups = await deps.listVanexPickups(status);
    return NextResponse.json({ pickups });
  } catch (error) {
    console.error("Failed to list Vanex pickups:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "فشل جلب طلبات الاستلام" }, { status: 500 });
  }
}

// POST /api/admin/vanex/pickups — request a courier pickup.
export async function handleRequestVanexPickup(deps: VanexPickupsDeps, req: Request): Promise<Response> {
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

    const result = await deps.requestVanexPickup({ phone, backupPhone, numberOfPackages, address, mapUrl, notes, services });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Failed to request Vanex pickup:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "فشل طلب الاستلام" }, { status: 500 });
  }
}
