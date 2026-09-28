import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { signMerchantToken, toMerchantDTO } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { getClientIp } from "@/lib/request-ip";

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

// Only failed attempts are logged (a successful login isn't a brute-force
// signal), so the count naturally ages out of the lockout window on its
// own — no explicit reset on success needed.
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS_PER_IP = 10;

export type LoginDeps = {
  db: {
    merchant: { findUnique: (args: { where: { phone: string } }) => Promise<Merchant | null> };
    loginAttempt: {
      count: (args: { where: { ip: string; createdAt: { gte: Date } } }) => Promise<number>;
      create: (args: { data: { ip: string } }) => Promise<unknown>;
    };
  };
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
//
// Rate-limited per IP (DB-backed, not in-memory — this runs on
// serverless, so counters must survive across invocations), same pattern
// as register.ts. Previously this endpoint — the one that actually
// guesses passwords — had NO rate limit at all, while registration
// (rate-limited purely for SMS cost reasons) did. That's backwards from
// what matters for brute-force risk.
export async function handleLogin(deps: LoginDeps, req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }
    const { phone, password } = parsed.data;

    const ip = getClientIp(req);
    if (ip) {
      const recentFailures = await deps.db.loginAttempt.count({
        where: { ip, createdAt: { gte: new Date(Date.now() - LOCKOUT_WINDOW_MS) } },
      });
      if (recentFailures >= MAX_FAILED_ATTEMPTS_PER_IP) {
        return NextResponse.json({ error: "محاولات دخول كثيرة، حاول لاحقًا" }, { status: 429 });
      }
    }

    const merchant = await deps.db.merchant.findUnique({ where: { phone } });

    if (!merchant || !deps.comparePassword(password, merchant.passwordHash)) {
      if (ip) await deps.db.loginAttempt.create({ data: { ip } });
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
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
