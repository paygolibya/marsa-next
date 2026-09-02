/**
 * DPay — the aggregator Rifqa routes all "wallet" checkout payments
 * through. One session-based flow covers 7 gateways; the customer picks
 * one at checkout. Plain `fetch`, no SDK — same house style as
 * src/lib/integrations/{vanex,email,sms}.ts. Mocked (auto-"paid") when
 * DPAY_API_TOKEN is absent, so dev/CI never needs real credentials.
 *
 * Contract confirmed live against https://dpay.ly/api (not guessed from
 * docs alone — the docs never state the verify endpoint path; it was
 * found by probing with a real token: POST /payment/sessions/verify
 * returns 422 "invalid session id" for a garbage id, vs 405 on every
 * other guessed path).
 */

const DPAY_BASE = "https://dpay.ly/api";

export const DPAY_PAY_METHODS = ["edfali", "sadad", "masrefypay", "yousrpay", "saharapay", "mobicash", "moamalat"] as const;
export type DpayPayMethod = (typeof DPAY_PAY_METHODS)[number];

export const DPAY_PAY_METHOD_LABELS: Record<DpayPayMethod, string> = {
  edfali: "إدفعلي",
  sadad: "سداد (المدار الجديد)",
  masrefypay: "مصرفي باي (الجمهورية)",
  yousrpay: "يسر باي (الوطني)",
  saharapay: "صحارى باي",
  mobicash: "موبي كاش",
  moamalat: "بطاقة مصرفية (معاملات)",
};

// Which extra checkout fields each gateway needs, for the UI to render the
// right inputs and for the request builder below to know what to send.
export const DPAY_REQUIRED_FIELDS: Record<DpayPayMethod, ("mobile" | "birthYear" | "cardNumber")[]> = {
  edfali: ["mobile"],
  sadad: ["mobile", "birthYear"],
  masrefypay: ["cardNumber"],
  yousrpay: ["cardNumber"],
  saharapay: ["cardNumber"],
  mobicash: ["cardNumber"],
  moamalat: [],
};

export type DpaySessionParams = {
  payMethod: DpayPayMethod;
  totalCents: number;
  orderId: string;
  customerMobile?: string;
  birthYear?: string;
  category?: number;
  cardNumber?: string;
  description?: string;
};

export type DpaySessionResult = {
  sessionId: number;
  status: string; // 'pending' | 'paid' | 'failed' | ...
  amount: number;
  feeCents: number;
  totalWithFeeCents: number;
  payMethod: string;
  expiredAt: string;
  paymentLink?: string; // moamalat only
};

/** DPay wants a plain LYD decimal (not our internal cents, and not Moamalat's own "dirham" minor unit — DPay abstracts that away). */
function centsToLyd(cents: number): number {
  return Math.round(cents) / 100;
}
function lydToCents(lyd: number): number {
  return Math.round(lyd * 100);
}

class DpayApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

async function dpayRequest(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = process.env.DPAY_API_TOKEN;
  if (!token) throw new Error("DPAY_API_TOKEN not set — caller should have used the mock path");

  const res = await fetch(`${DPAY_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new DpayApiError((json.message as string) ?? `DPay API error ${res.status}`, res.status);
  }
  return json;
}

function parseSessionResponse(json: Record<string, unknown>): DpaySessionResult {
  return {
    sessionId: json.session_id as number,
    status: json.status as string,
    amount: json.amount as number,
    feeCents: lydToCents((json.fee_amount as number) ?? 0),
    totalWithFeeCents: lydToCents((json.total as number) ?? (json.amount as number)),
    payMethod: json.pay_method as string,
    expiredAt: json.expired_at as string,
    paymentLink: json.payment_link as string | undefined,
  };
}

export async function openDpaySession(params: DpaySessionParams): Promise<DpaySessionResult> {
  if (!process.env.DPAY_API_TOKEN) {
    await new Promise((r) => setTimeout(r, 150));
    const mockId = Date.now();
    return {
      sessionId: mockId,
      status: "paid", // mock resolves instantly, matching the old DPay mock's behavior
      amount: centsToLyd(params.totalCents),
      feeCents: 0,
      totalWithFeeCents: params.totalCents,
      payMethod: params.payMethod,
      expiredAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      paymentLink: params.payMethod === "moamalat" ? `/mock-moamalat-pay/${mockId}` : undefined,
    };
  }

  const body: Record<string, unknown> = {
    pay_method: params.payMethod,
    amount: centsToLyd(params.totalCents),
    data: { order_id: params.orderId },
  };
  if (params.customerMobile) body.customer_mobile = params.customerMobile;
  if (params.birthYear) body.birth_year = params.birthYear;
  if (params.category != null) body.category = params.category;
  if (params.cardNumber) body.card_number = params.cardNumber;
  if (params.description) body.description = params.description;

  const json = await dpayRequest("/payment/sessions/open", body);
  return parseSessionResponse(json);
}

export async function verifyDpaySession(params: { sessionId: number; otp: string }): Promise<DpaySessionResult> {
  if (!process.env.DPAY_API_TOKEN) {
    await new Promise((r) => setTimeout(r, 150));
    return {
      sessionId: params.sessionId,
      status: "paid",
      amount: 0,
      feeCents: 0,
      totalWithFeeCents: 0,
      payMethod: "mock",
      expiredAt: new Date().toISOString(),
    };
  }

  const json = await dpayRequest("/payment/sessions/verify", { session_id: params.sessionId, otp: params.otp });
  return parseSessionResponse(json);
}

export { DpayApiError, centsToLyd, lydToCents };
