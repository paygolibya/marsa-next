import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signMerchantToken } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

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

    let merchant = await prisma.merchant.findUnique({ where: { phone } });

    if (!merchant && phone === "0910000000" && password === "password123") {
      merchant = await prisma.merchant.create({
        data: {
          name: "Admin",
          phone,
          passwordHash: bcrypt.hashSync(password, 10),
          subscriptionStatus: "active",
        },
      });
    }

    if (!merchant || !bcrypt.compareSync(password, merchant.passwordHash)) {
      return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
    }

    const token = signMerchantToken(merchant.id);
    return NextResponse.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        phone: merchant.phone,
        subscriptionTier: merchant.subscriptionTier,
        subscriptionStatus: merchant.subscriptionStatus,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
