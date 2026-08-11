import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { cancelVanexPickup } from "@/lib/integrations/vanex";

// DELETE /api/admin/vanex/pickups/[id] — cancel a pending pickup request.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await cancelVanexPickup(Number(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel Vanex pickup:", error);
    return NextResponse.json({ error: "فشل إلغاء طلب الاستلام" }, { status: 500 });
  }
}
