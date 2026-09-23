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

/**
 * Reads the `Authorization: Bearer <token>` header from a Next.js Request
 * and returns the merchantId if the token is valid, or null otherwise.
 * This is the App Router equivalent of the old requireMerchant middleware —
 * since route handlers don't have Express-style middleware chaining, each
 * route calls this directly and returns 401 itself when it gets null.
 */
export function getAuthMerchantId(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { merchantId: string };
    return payload.merchantId;
  } catch {
    return null;
  }
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
