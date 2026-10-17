import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthPayload } from "@/lib/auth";
import { updateMerchantProfileSchema } from "@/lib/validation";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

export type MerchantProfileDb = {
  merchant: {
    update: (args: { where: { id: string }; data: { email: string | null } }) => Promise<{ id: string; email: string | null }>;
  };
};

// PATCH /api/merchant/profile — { email } (null/"" clears it). Email is
// currently the only self-editable profile field — set from
// NotificationBell.tsx's panel, the sole place that collects it (no
// signup step asks for an email at all, phone is the sole identifier).
// Blocked during an admin impersonation session (signImpersonationToken's
// impersonatedBy claim, see auth.ts) — an admin helping a merchant from
// inside their dashboard has no legitimate reason to change where that
// merchant's own order/stock alerts get sent, and this is the only
// self-service profile field that exists today for an impersonator to
// touch (there's no password-change endpoint anywhere in this app).
export async function handleUpdateMerchantProfile(db: MerchantProfileDb, req: Request): Promise<Response> {
  const payload = getAuthPayload(req);
  if (!payload) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  if (payload.impersonatedBy) {
    return NextResponse.json({ error: "لا يمكن تعديل بيانات الحساب أثناء جلسة انتحال الهوية" }, { status: 403 });
  }
  const merchantId = payload.merchantId;

  try {
    const body = await readJsonBody(req);
    const parsed = updateMerchantProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const updated = await db.merchant.update({ where: { id: merchantId }, data: { email: parsed.data.email ?? null } });
    return NextResponse.json({ email: updated.email });
  } catch (err) {
    if (err instanceof MalformedJsonError) return malformedJsonResponse();
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
