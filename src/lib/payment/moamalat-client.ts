import crypto from "crypto";

// Direct Moamalat LightBox integration — see docs/moamalat.md for the full
// contract and how it was verified. Replaces the old DPay aggregator,
// which was passing Moamalat sessions through fine on its own side but
// its hosted payment page couldn't find the resulting order ("Order Not
// Found") — an issue on DPay/Moamalat's own backend, not fixable from
// this codebase, so this goes direct instead.

const TEST_LIGHTBOX_JS_URL = "https://tnpg.moamalat.net:6006/js/lightbox.js";
const PRODUCTION_LIGHTBOX_JS_URL = "https://npg.moamalat.net:6006/js/lightbox.js";

export function isMoamalatConfigured(): boolean {
  return Boolean(process.env.MOAMALAT_MERCHANT_ID && process.env.MOAMALAT_TERMINAL_ID && process.env.MOAMALAT_SECRET_KEY);
}

export function getLightboxScriptUrl(): string {
  return process.env.MOAMALAT_ENV === "production" ? PRODUCTION_LIGHTBOX_JS_URL : TEST_LIGHTBOX_JS_URL;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// The one HMAC recipe Moamalat uses everywhere (request signing, the
// completeCallback/errorCallback response, and the server notification):
// sort field names alphabetically, join as "name=value" pairs with "&",
// HMAC-SHA256 the result using the hex-decoded secret key as the HMAC key,
// output uppercase hex. Confirmed against their docs' own worked example
// (Amount=100&DateTimeLocalTrxn=...&MerchantId=...&MerchantReference=...&TerminalId=...).
function computeSecureHash(fields: Record<string, string>, secretKeyHex: string): string {
  const message = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${fields[key]}`)
    .join("&");
  const key = Buffer.from(secretKeyHex, "hex");
  return crypto.createHmac("sha256", key).update(message, "utf8").digest("hex").toUpperCase();
}

// yyyyMMddHHmm — 12 characters, no seconds, Confirmed by docs.moamalat.net.
// Must be Libya's own local time (UTC+2, no DST since 2013), computed
// explicitly via Africa/Tripoli rather than the server's local clock —
// Date.prototype.getHours() etc. use the SERVER's timezone, which is UTC
// on Vercel. That 2-hour skew was silently fine when tested against a
// local dev server (close enough to pass), but caused Moamalat's widget
// to reject every real request once deployed ("Something went wrong"),
// since a valid session evidently requires the timestamp to be close to
// Moamalat's own clock in real Libyan time.
function formatTrxDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Tripoli",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hour12:false can render midnight as "24" in some ICU builds — normalize.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}${get("month")}${get("day")}${hour}${get("minute")}`;
}

// Moamalat's AmountTrxn is in the smallest currency subunit — their own
// docs give the example "1 Libyan dinar should be 1000" (i.e. 1 LYD =
// 1000 units, NOT the 100-per-unit "cents" this codebase uses everywhere
// else for money). This app's Int-cents convention (100 LYD = 10000) is
// exactly 1/10th of what Moamalat wants, so the conversion is a flat *10 —
// verified against their docs directly, not guessed, since getting this
// wrong either overcharges or undercharges a real customer by 10x.
export function centsToMoamalatAmount(cents: number): number {
  return cents * 10;
}
export function moamalatAmountToCents(amount: number): number {
  return Math.round(amount / 10);
}

export type LightboxConfig = {
  MID: string;
  TID: string;
  AmountTrxn: number;
  MerchantReference: string;
  TrxDateTime: string;
  SecureHash: string;
};

// Server-side only — the secret key must never reach the browser. This
// builds everything the client needs to call Lightbox.Checkout.configure
// / showLightbox() itself; see docs.moamalat.net's own example, which
// passes exactly these five data fields plus the three callbacks.
export function buildLightboxConfig(totalCents: number, merchantReference: string): LightboxConfig {
  const MID = requireEnv("MOAMALAT_MERCHANT_ID");
  const TID = requireEnv("MOAMALAT_TERMINAL_ID");
  const secretKey = requireEnv("MOAMALAT_SECRET_KEY");
  const TrxDateTime = formatTrxDateTime(new Date());
  const AmountTrxn = centsToMoamalatAmount(totalCents);

  const SecureHash = computeSecureHash(
    {
      Amount: String(AmountTrxn),
      DateTimeLocalTrxn: TrxDateTime,
      MerchantId: MID,
      MerchantReference: merchantReference,
      TerminalId: TID,
    },
    secretKey
  );

  return { MID, TID, AmountTrxn, MerchantReference: merchantReference, TrxDateTime, SecureHash };
}

// Used for BOTH the client-relayed completeCallback/errorCallback payload
// and the server-to-server notification — same alphabetical-sort-and-HMAC
// rule the docs describe for each ("all response query string parameters
// except SecureHash", sorted ascending). Caller passes every field it got
// back except SecureHash itself.
export function verifyMoamalatResponseHash(fields: Record<string, string>, receivedHash: string | undefined | null): boolean {
  const secretKey = process.env.MOAMALAT_SECRET_KEY;
  if (!secretKey || !receivedHash) return false;
  const expected = computeSecureHash(fields, secretKey);
  return expected === receivedHash.toUpperCase();
}

// MerchantReference is the one thing Moamalat echoes back verbatim in
// every response/notification — used here as the sole correlation key
// (no separate "session id" concept exists in LightBox the way DPay had
// one), prefixed so the same complete/webhook endpoints can tell a buyer
// order and a merchant subscription payment apart.
export function makeOrderReference(orderId: string): string {
  return `order:${orderId}`;
}
export function makeSubscriptionReference(paymentId: string): string {
  return `sub:${paymentId}`;
}
export function parseMerchantReference(ref: string): { kind: "order" | "subscription"; id: string } | null {
  if (ref.startsWith("order:")) return { kind: "order", id: ref.slice(6) };
  if (ref.startsWith("sub:")) return { kind: "subscription", id: ref.slice(4) };
  return null;
}
