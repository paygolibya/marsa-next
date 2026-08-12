import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

// Same secret/env convention as the original Express middleware
// (src/middleware/auth.js) — falls back to a dev secret only outside prod.
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

function getAllowedAdminValues() {
  const ids = (process.env.ADMIN_MERCHANT_IDS || process.env.ADMIN_MERCHANT_ID || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const phones = (process.env.ADMIN_MERCHANT_PHONES || process.env.ADMIN_MERCHANT_PHONE || "0910000000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const fallbackPhones = ["0910000000"];
  const normalizedPhones = Array.from(new Set([...phones, ...fallbackPhones]));

  return { ids, phones: normalizedPhones };
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
}) {
  return {
    id: merchant.id,
    name: merchant.name,
    phone: merchant.phone,
    subscriptionTier: merchant.subscriptionTier,
    subscriptionStatus: merchant.subscriptionStatus,
    phoneVerified: merchant.phoneVerified,
  };
}
