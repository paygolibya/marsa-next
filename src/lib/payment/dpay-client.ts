import crypto from "crypto";

// DPay's "Payment Sessions" API, scoped to exactly one of its six
// pay_methods: moamalat. Replaces the old direct-Moamalat LightBox
// integration (HMAC-signed widget embedded in-page) — DPay now hosts the
// entire card-entry + OTP flow on its own page (`payment_link`), confirmed
// server-to-server via a signed webhook instead of a browser-relayed
// JS callback. See docs.dpay.ly (account dashboard) for the full contract.

const DPAY_BASE_URL = "https://dpay.ly/api";

export function isDpayConfigured(): boolean {
  return Boolean(process.env.DPAY_API_TOKEN);
}

// DPay's docs state a 0.01 LYD minimum, but the real live API enforces
// 5 LYD ("Amount is below the minimum deposit of 5") — confirmed directly
// against the real endpoint before writing this, not assumed from the
// docs. Checked by callers before ever calling openDpaySession, so a
// buyer sees a clear message instead of a raw DPay 400 leaking through.
export const DPAY_MIN_AMOUNT_CENTS = 500;

export type OpenDpaySessionResult = {
  sessionId: number;
  paymentLink: string;
  feeCents: number;
  expiresAt: string;
};

// amountCents -> LYD with exactly 2 decimals. amountCents is always a
// whole number of cents, so this conversion is exact (no float drift) —
// still routed through toFixed+Number rather than raw division to avoid
// relying on IEEE754 behaving exactly as expected for every input.
function centsToLyd(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

// DPay's fee_amount comes back as a decimal LYD string/number (e.g.
// "0.01") — converts to cents the same deliberate way, via toFixed/round
// rather than a raw multiply, since this is money being recorded, not
// just displayed.
function lydToCents(amountLyd: number): number {
  return Math.round(amountLyd * 100);
}

// POST /payment/sessions/open — pay_method fixed to "moamalat" (the only
// gateway in scope for now). `ref` is one of makeOrderReference/
// makeSubscriptionReference below, round-tripped through DPay's `data`
// field (echoed back verbatim in the webhook payload) rather than
// needing a separate correlation column. `idempotencyKey` should be the
// Order/Payment row's own id — retrying this call with the same key
// returns the original session instead of opening a duplicate one
// (confirmed against the real API: same key -> same session_id back).
export async function openDpaySession(amountCents: number, ref: string, idempotencyKey: string): Promise<OpenDpaySessionResult> {
  const token = process.env.DPAY_API_TOKEN;
  if (!token) throw new Error("DPAY_API_TOKEN is not set");

  const response = await fetch(`${DPAY_BASE_URL}/payment/sessions/open`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ pay_method: "moamalat", amount: centsToLyd(amountCents), data: { ref } }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.payment_link || typeof body?.session_id !== "number") {
    throw new Error(`DPay session-open failed (${response.status}): ${body?.message ?? "unknown error"}`);
  }

  return {
    sessionId: body.session_id,
    paymentLink: body.payment_link,
    feeCents: lydToCents(parseFloat(body.fee_amount ?? "0")),
    expiresAt: body.expired_at,
  };
}

export function isDpayWebhookConfigured(): boolean {
  return Boolean(process.env.DPAY_WEBHOOK_SECRET);
}

// hmac_sha256(timestamp + '.' + rawBody, secret), constant-time compare,
// reject anything older than 5 minutes (DPay's own replay-protection
// recommendation). Must be called with the RAW request body text, read
// before any JSON.parse — re-serializing the parsed JSON would not
// reproduce the exact bytes DPay signed.
export function verifyDpayWebhookSignature(timestamp: string | null, rawBody: string, signature: string | null): boolean {
  const secret = process.env.DPAY_WEBHOOK_SECRET;
  if (!secret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let receivedBuf: Buffer;
  try {
    receivedBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

// Kept verbatim from the old moamalat-client.ts — DPay's `data` field
// round-trips this exact string through the webhook payload, so the
// dispatch/finalize logic downstream (dpay-dispatch.ts) needs no changes
// at all for this swap.
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
