import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

type Merchant = {
  id: string;
  name: string;
  phone: string;
  passwordHash: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  phoneVerified: boolean;
  subscriptionEndDate?: Date | null;
  trialEndsAt?: Date | null;
};

export type LoginDeps = {
  db: { merchant: { findUnique: (args: { where: { phone: string } }) => Promise<Merchant | null> } };
  expireIfLapsed: (merchantId: string) => Promise<boolean>;
  // Injected so tests never depend on the real bcrypt cost factor being
  // fast/slow, and can exercise both branches deterministically without a
  // real hash. Defaults to bcryptjs's real compareSync in route.ts.
  comparePassword: (password: string, hash: string) => boolean;
};

// POST /api/auth/login — log in, get a JWT. See route.ts for why this is
// injectable — credential handling is a distinct risk category from the
// payment/order routes already covered (a bug here is an auth bypass or a
// wrongly-rejected legitimate login, not a money-accounting error), so it
// gets its own real test coverage: wrong password, unknown phone, and the
// login-time lapsed-subscription auto-expiry side effect.
export async function handleLogin(deps: LoginDeps, req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }
    const { phone, password } = parsed.data;

    const merchant = await deps.db.merchant.findUnique({ where: { phone } });

    if (!merchant || !deps.comparePassword(password, merchant.passwordHash)) {
      return NextResponse.json({ error: "Invalid phone or password" }, { status: 401 });
    }

    const expired = await deps.expireIfLapsed(merchant.id);
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
