// Client-safe admin check — split out from lib/auth.ts so components that
// need it don't pull jsonwebtoken/prisma into the browser bundle.
export function isAdminMerchant(merchant: { id?: string | null; phone?: string | null } | null | undefined) {
  if (!merchant) return false;

  const phones = (process.env.NEXT_PUBLIC_ADMIN_MERCHANT_PHONES || "0910000000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return Boolean(merchant.phone && phones.includes(merchant.phone));
}
