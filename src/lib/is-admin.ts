// Client-safe admin check — split out from lib/auth.ts so components that
// need it don't pull jsonwebtoken/prisma into the browser bundle. This is
// UI visibility only (whether the "لوحة الإدارة" nav link shows) — the
// real authorization boundary is server-side isAdminMerchantId
// (src/lib/auth.ts), which every admin API route calls independently. No
// hardcoded fallback phone (there used to be one — see auth.ts's comment
// on the same fix); unset means no one sees the admin UI, which is the
// safe default.
export function isAdminMerchant(merchant: { id?: string | null; phone?: string | null } | null | undefined) {
  if (!merchant) return false;

  const phones = (process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Boolean(merchant.phone && phones.includes(merchant.phone));
}
