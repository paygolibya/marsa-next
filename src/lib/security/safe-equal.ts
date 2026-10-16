import { timingSafeEqual } from "node:crypto";

// Constant-time string comparison for secrets and signatures (webhook keys,
// payment hashes). A plain `===` returns as soon as the first character
// differs, so response timing can leak how much of a guessed value was
// right. Unequal lengths return false immediately — length isn't secret.
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
