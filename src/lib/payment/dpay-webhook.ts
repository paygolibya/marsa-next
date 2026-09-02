import { createHmac, timingSafeEqual } from "crypto";

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Verifies a DPay webhook per their documented scheme:
 *   signature = hex(hmac_sha256(`${timestamp}.${rawBody}`, secret))
 * compared in constant time, with the timestamp rejected if older than 5
 * minutes (replay protection, per DPay's docs). Must run against the raw
 * request body — re-serializing a parsed JSON object can reorder keys or
 * change whitespace and silently break the signature.
 */
export function verifyDpayWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!timestampHeader || !signatureHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest("hex");

  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
