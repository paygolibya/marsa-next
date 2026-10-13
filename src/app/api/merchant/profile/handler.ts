import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateMerchantProfileSchema } from "@/lib/validation";

export type MerchantProfileDb = {
  merchant: {
    update: (args: { where: { id: string }; data: { email: string | null } }) => Promise<{ id: string; email: string | null }>;
  };
};

// PATCH /api/merchant/profile — { email } (null/"" clears it). Email is
// currently the only self-editable profile field — set from
// NotificationBell.tsx's panel, the sole place that collects it (no
// signup step asks for an email at all, phone is the sole identifier).
export async function handleUpdateMerchantProfile(db: MerchantProfileDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = updateMerchantProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const updated = await db.merchant.update({ where: { id: merchantId }, data: { email: parsed.data.email ?? null } });
    return NextResponse.json({ email: updated.email });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
