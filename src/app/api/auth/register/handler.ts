import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import bcrypt from "bcryptjs";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import type { RequestOtpResult } from "@/lib/integrations/sms";
import { getClientIp } from "@/lib/request-ip";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP_PER_HOUR = 3;
// The 90-day free trial was offered to reach the first ~70 merchants.
// That goal is met — new signups from here on get no trial and must
// subscribe (any billing period) before their dashboard unlocks, same as
// "inactive" already works for a lapsed subscription (dashboard/layout.tsx).

type MerchantRow = Parameters<typeof toMerchantDTO>[0] & { id: string };

export type RegisterDb = {
  merchant: {
    findUnique: (args: { where: { phone: string } }) => Promise<{ id: string } | null>;
    count: (args: { where: { registrationIp: string; createdAt: { gte: Date } } }) => Promise<number>;
    create: (args: {
      data: {
        name: string;
        phone: string;
        passwordHash: string;
        subscriptionStatus: string;
        registrationIp: string | null;
        otpCodeHash: string;
        otpExpiresAt: Date;
        otpSentAt: Date;
        [key: string]: unknown;
      };
    }) => Promise<MerchantRow>;
  };
};

export type RegisterDeps = {
  db: RegisterDb;
  requestOtpPin: (phone: string) => Promise<RequestOtpResult>;
};

// POST /api/auth/register — create a merchant account and send an OTP to
// verify the phone number. Rate-limited per IP (DB-backed, not in-memory —
// this runs on serverless, so counters must survive across invocations)
// since this is now the one endpoint in the app that triggers a real,
// billable SMS send on every call.
export async function handleRegister(deps: RegisterDeps, req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { name, phone, password } = parsed.data;

    const existing = await deps.db.merchant.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json({ error: "An account with this phone already exists" }, { status: 409 });
    }

    const registrationIp = getClientIp(req);
    if (registrationIp) {
      const recentCount = await deps.db.merchant.count({
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
    const otpResult = await deps.requestOtpPin(phone);
    const otpCodeHash = bcrypt.hashSync(otpResult.pin, 10);

    const merchant = await deps.db.merchant.create({
      data: {
        name,
        phone,
        passwordHash,
        // No free trial — the merchant can still complete onboarding (the
        // dashboard gate below is the only place this is enforced), but
        // dashboard/layout.tsx blocks them at "inactive" with a link to
        // /subscription until they actually pay for a billing period.
        subscriptionStatus: "inactive",
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
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
