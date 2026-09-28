import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import { getAuthMerchantId } from "@/lib/auth";
import type { RequestOtpResult } from "@/lib/integrations/sms";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

type MerchantRow = { id: string; phone: string; phoneVerified: boolean; otpSentAt: Date | null };

export type ResendOtpDb = {
  merchant: {
    findUnique: (args: { where: { id: string } }) => Promise<MerchantRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

export type ResendOtpDeps = {
  db: ResendOtpDb;
  requestOtpPin: (phone: string) => Promise<RequestOtpResult>;
};

// POST /api/auth/resend-otp — Bearer-authed. Enforces the cooldown
// server-side (not just disabling the button client-side) and resets the
// failed-attempt counter along with issuing a fresh code.
export async function handleResendOtp(deps: ResendOtpDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const merchant = await deps.db.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (merchant.phoneVerified) {
      return NextResponse.json({ error: "تم التحقق من رقمك بالفعل" }, { status: 400 });
    }

    if (merchant.otpSentAt && Date.now() - merchant.otpSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - merchant.otpSentAt.getTime())) / 1000);
      return NextResponse.json({ error: `الرجاء الانتظار ${waitSeconds} ثانية قبل إعادة الإرسال` }, { status: 429 });
    }

    const otpResult = await deps.requestOtpPin(merchant.phone);
    await deps.db.merchant.update({
      where: { id: merchantId },
      data: {
        otpCodeHash: bcrypt.hashSync(otpResult.pin, 10),
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        otpSentAt: new Date(),
        otpAttempts: 0,
      },
    });

    if (!otpResult.success) {
      return NextResponse.json({ error: "فشل إرسال الرمز، حاول مجددًا" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
