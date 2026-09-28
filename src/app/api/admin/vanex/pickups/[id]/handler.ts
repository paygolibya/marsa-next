import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export type CancelVanexPickupDeps = {
  cancelVanexPickup: (collectId: number) => Promise<true>;
};

// DELETE /api/admin/vanex/pickups/[id] — cancel a pending pickup request.
export async function handleCancelVanexPickup(deps: CancelVanexPickupDeps, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await deps.cancelVanexPickup(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel Vanex pickup:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "فشل إلغاء طلب الاستلام" }, { status: 500 });
  }
}
