import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { requestOtpPin } from "@/lib/integrations/sms";
import { getPlanFeatureFlags } from "@/lib/checkout-features";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP_PER_HOUR = 3;
const TRIAL_DAYS = 90;
// Full-featured tier during the trial, so a merchant can actually evaluate
// DPay/API access/etc — not the earlier behavior of sitting in "pending"
// with no tier at all until an admin manually reviewed a payment receipt.
const TRIAL_TIER = "advanced";

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : null;
}

// POST /api/auth/register — create a merchant account and send an OTP to
// verify the phone number. Rate-limited per IP (DB-backed, not in-memory —
// this runs on serverless, so counters must survive across invocations)
// since this is now the one endpoint in the app that triggers a real,
// billable SMS send on every call.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { name, phone, password } = parsed.data;

    const existing = await prisma.merchant.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "An account with this phone already exists" }, { status: 409 });
    }

    const registrationIp = getClientIp(req);
    if (registrationIp) {
      const recentCount = await prisma.merchant.count({
        where: {
          registrationIp,
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recentCount >= MAX_REGISTRATIONS_PER_IP_PER_HOUR) {
        return NextResponse.json({ error: "محاولات تسجيل كثيرة، حاول لاحقًا" }, { status: 429 });
      }
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    // Resala generates the actual OTP code themselves (see requestOtpPin) —
    // we just hash and store whatever they hand back, same as a
    // self-generated one.
    const otpResult = await requestOtpPin(phone);
    const otpCodeHash = bcrypt.hashSync(otpResult.pin, 10);
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const merchant = await prisma.merchant.create({
      data: {
        name,
        phone,
        passwordHash,
        // 90-day free trial starts immediately — no payment/receipt review
        // gate for new signups. subscriptionEndDate is the field that
        // actually gates dashboard access (see dashboard/layout.tsx and
        // src/lib/subscription/expire.ts); trialEndsAt is kept alongside
        // it purely so the UI/admin can tell a trial apart from a real
        // paid period once one starts.
        subscriptionStatus: "active",
        subscriptionTier: TRIAL_TIER,
        subscriptionStartDate: new Date(),
        subscriptionEndDate: trialEndsAt,
        trialEndsAt,
        ...getPlanFeatureFlags(TRIAL_TIER),
        registrationIp,
        otpCodeHash,
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        otpSentAt: new Date(),
      },
    });

    const token = signMerchantToken(merchant.id);
    return NextResponse.json(
      {
        token,
        merchant: toMerchantDTO(merchant),
        otpSendFailed: !otpResult.success,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
