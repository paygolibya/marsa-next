import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMerchantToken } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";

// POST /api/auth/register — create a merchant account.
// Ported from marsa-backend/src/routes/auth.js (POST /register).
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

    const passwordHash = bcrypt.hashSync(password, 10);
    const merchant = await prisma.merchant.create({
      data: { name, phone, passwordHash, subscriptionStatus: "pending" },
    });

    const token = signMerchantToken(merchant.id);
    return NextResponse.json(
      {
        token,
        merchant: {
          id: merchant.id,
          name: merchant.name,
          phone: merchant.phone,
          subscriptionTier: merchant.subscriptionTier,
          subscriptionStatus: merchant.subscriptionStatus,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
