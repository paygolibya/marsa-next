import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { updateStoreSettingsSchema } from "@/lib/validation";

// PATCH /api/stores/:id — edit store settings/policies (needs auth + ownership).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    const store = await prisma.store.findFirst({ where: { id, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const body = await req.json();
    const parsed = updateStoreSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const updated = await prisma.store.update({ where: { id }, data: parsed.data });
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
