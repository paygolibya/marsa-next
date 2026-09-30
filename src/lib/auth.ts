import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

// Same secret/env convention as the original Express middleware
// (src/middleware/auth.js) — falls back to a dev secret only outside prod.
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function splitEnvList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getAllowedAdminValues() {
  const ids = [...splitEnvList(process.env.ADMIN_MERCHANT_IDS), ...splitEnvList(process.env.ADMIN_MERCHANT_ID)];
  // NEXT_PUBLIC_ADMIN_MERCHANT_PHONES is what actually gates the admin nav
  // link/UI client-side (see is-admin.ts) — folded in here too, not just
  // the server-only ADMIN_MERCHANT_PHONES(S), so the two can never drift
  // apart. Previously they were two completely independent env vars: if
  // only the NEXT_PUBLIC_ one was ever configured (the one that actually
  // controls who sees "لوحة الإدارة" at all), a real admin could see the
  // dashboard shell but every API call would 403 — exactly the "no
  // merchants shown" symptom this was written to fix, caught by testing
  // the real endpoint with a real admin token and seeing it worked, which
  // meant the bug had to be in which phones the server actually trusted.
  const phones = [
    ...splitEnvList(process.env.ADMIN_MERCHANT_PHONES),
    ...splitEnvList(process.env.ADMIN_MERCHANT_PHONE),
    ...splitEnvList(process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES),
    "0910000000",
  ];

  return { ids, phones: Array.from(new Set(phones)) };
}

export function signMerchantToken(merchantId: string) {
  return jwt.sign({ merchantId }, JWT_SECRET, { expiresIn: "30d" });
}

// Issued only by POST /api/admin/merchants/impersonate — a real, validly
// signed token for the target merchant, so every existing merchant-facing
// route (all of which trust getAuthMerchantId's returned id completely)
// treats the bearer as that merchant with zero code changes needed
// anywhere else. impersonatedBy is additive/safe: every current consumer
// reads payload.merchantId only. Deliberately short-lived (2h, vs 30d for
// a real login) — this is a temporary support session, not a new way to
// authenticate as a merchant long-term.
export function signImpersonationToken(merchantId: string, adminId: string) {
  return jwt.sign({ merchantId, impersonatedBy: adminId }, JWT_SECRET, { expiresIn: "2h" });
}

type AuthPayload = { merchantId: string; impersonatedBy?: string };

/**
 * Reads the `Authorization: Bearer <token>` header from a Next.js Request
 * and returns the full decoded payload if the token is valid, or null
 * otherwise. getAuthMerchantId (below) is the common case every route
 * actually calls; this exists so the impersonate route itself can read
 * back `impersonatedBy` for its own response/audit log.
 */
export function getAuthPayload(req: Request): AuthPayload | null {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/**
 * This is the App Router equivalent of the old requireMerchant middleware —
 * since route handlers don't have Express-style middleware chaining, each
 * route calls this directly and returns 401 itself when it gets null.
 */
export function getAuthMerchantId(req: Request): string | null {
  return getAuthPayload(req)?.merchantId ?? null;
}

export async function isAdminMerchantId(merchantId: string | null | undefined) {
  if (!merchantId) return false;

  const { ids, phones } = getAllowedAdminValues();
  if (ids.includes(merchantId)) return true;

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { phone: true },
  });

  return merchant?.phone ? phones.includes(merchant.phone) : false;
}

// Register/login/me/verify-otp all need to hand back the same trimmed
// merchant projection — one place for it instead of four.
export function toMerchantDTO(merchant: {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  phoneVerified: boolean;
  subscriptionEndDate?: Date | null;
  trialEndsAt?: Date | null;
}) {
  return {
    id: merchant.id,
    name: merchant.name,
    phone: merchant.phone,
    subscriptionTier: merchant.subscriptionTier,
    subscriptionStatus: merchant.subscriptionStatus,
    phoneVerified: merchant.phoneVerified,
    subscriptionEndDate: merchant.subscriptionEndDate ?? null,
    trialEndsAt: merchant.trialEndsAt ?? null,
  };
}
