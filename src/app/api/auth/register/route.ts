import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { sendOtpSms } from "@/lib/integrations/sms";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP_PER_HOUR = 3;

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    const otp = generateOtp();
    const otpCodeHash = bcrypt.hashSync(otp, 10);

    const merchant = await prisma.merchant.create({
      data: {
        name,
        phone,
        passwordHash,
        subscriptionStatus: "pending",
        registrationIp,
        otpCodeHash,
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
        otpSentAt: new Date(),
      },
    });

    const smsResult = await sendOtpSms(phone, otp);

    const token = signMerchantToken(merchant.id);
    return NextResponse.json(
      {
        token,
        merchant: toMerchantDTO(merchant),
        otpSendFailed: !smsResult.success,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
