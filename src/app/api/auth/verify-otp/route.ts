import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, toMerchantDTO } from "@/lib/auth";

const MAX_ATTEMPTS = 5;

// POST /api/auth/verify-otp — { code }. Bearer-authed (merchant already has
// a session from register). Locks out after MAX_ATTEMPTS failures until a
// resend issues a fresh code — a 6-digit code is only 1,000,000
// combinations, so an unlimited-attempt loop within the expiry window would
// otherwise be a real brute-force path.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });
    }

    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (merchant.phoneVerified) {
      return NextResponse.json({ merchant: toMerchantDTO(merchant) });
    }

    if (merchant.otpAttempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: "محاولات كثيرة، اطلب رمزًا جديدًا" }, { status: 429 });
    }

    if (!merchant.otpCodeHash || !merchant.otpExpiresAt || merchant.otpExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "انتهت صلاحية الرمز، اطلب رمزًا جديدًا" }, { status: 400 });
    }

    const matches = bcrypt.compareSync(code, merchant.otpCodeHash);
    if (!matches) {
      await prisma.merchant.update({
        where: { id: merchantId },
        data: { otpAttempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "رمز التحقق غير صحيح" }, { status: 400 });
    }

    const updated = await prisma.merchant.update({
      where: { id: merchantId },
      data: { phoneVerified: true, otpCodeHash: null, otpExpiresAt: null, otpAttempts: 0 },
    });

    return NextResponse.json({ merchant: toMerchantDTO(updated) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
