import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { expireIfLapsed } from "@/lib/subscription/expire";

// POST /api/auth/login — log in, get a JWT.
// Ported from marsa-backend/src/routes/auth.js (POST /login).
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }
    const { phone, password } = parsed.data;

    const merchant = await prisma.merchant.findUnique({ where: { phone } });

    if (!merchant || !bcrypt.compareSync(password, merchant.passwordHash)) {
      return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
    }

    const expired = await expireIfLapsed(merchant.id);
    const token = signMerchantToken(merchant.id);
    return NextResponse.json({
      token,
      merchant: toMerchantDTO(expired ? { ...merchant, subscriptionStatus: "inactive" } : merchant),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
