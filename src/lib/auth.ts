import jwt from "jsonwebtoken";

// Same secret/env convention as the original Express middleware
// (src/middleware/auth.js) — falls back to a dev secret only outside prod.
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

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
