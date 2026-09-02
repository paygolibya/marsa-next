/**
 * SMS via Resala (Libyan SMS provider), called with plain `fetch` — no
 * SDK, same pattern as email.ts and the Vanex/DPay integrations.
 *
 * This replaces an earlier version built against a guessed generic
 * `POST /sms/send {phone, message}` endpoint that doesn't exist on
 * Resala's real API — confirmed live against a real account token, not
 * guessed (same category of correction Vanex/DPay needed before their
 * real contracts were known). Resala's actual API has two genuinely
 * different mechanisms, not one:
 *
 *  - OTP ("pins"): `POST /pins` — Resala generates the code itself and
 *    returns it in the response; there is no free-text send and no
 *    separate verify endpoint on their side ("التحقق من الرمز
 *    مسؤوليتك" — verifying it is your own responsibility). We store
 *    whatever pin they generated (bcrypt-hashed, same as the old
 *    self-generated flow) and compare it ourselves when the user submits
 *    it — see requestOtpPin().
 *  - Everything else (order/shipment notifications): Resala only sends
 *    pre-approved DASHBOARD TEMPLATES with $1/$2-style placeholders —
 *    there's no endpoint to send arbitrary text at all. Until real
 *    template ids exist (created in Resala's dashboard, then set as
 *    RESALA_TEMPLATE_*_ID env vars here), sendNewOrderSms/
 *    sendShipmentStatusSms mock-log exactly like before — flipping them
 *    to "real" against a nonexistent generic endpoint the moment a real
 *    API key exists would just break them, not fix them.
 */

const RESALA_API_URL_DEFAULT = "https://dev.resala.ly/api/v1";
// Resala's own domain is literally "dev.resala.ly" for both their docs and
// real production traffic — confirmed via a real account's message log
// showing `"env": "production"` / `"status": "delivered"` entries. "dev"
// here is just their naming, not a sandbox — don't mistake it for one.

export type SendSmsResult = { success: boolean; error?: string };
export type RequestOtpResult = { success: boolean; pin: string; error?: string };

/**
 * Normalize a Libyan mobile number to the canonical 09XXXXXXXX form used
 * everywhere in this app's stored data. Accepts +218/218/00218-prefixed
 * input and strips it down to the local form. Returns null if the result
 * isn't a valid Libyan mobile number.
 */
export function normalizeLibyanPhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (cleaned.startsWith("00218")) cleaned = "0" + cleaned.slice(5);
  else if (cleaned.startsWith("218")) cleaned = "0" + cleaned.slice(3);
  return /^09\d{8}$/.test(cleaned) ? cleaned : null;
}

/** Resala wants full international digits, no +, no leading 0: 218910001234. */
function toResalaInternational(localPhone: string): string {
  return `218${localPhone.slice(1)}`;
}

function generateFallbackPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Requests Resala generate + send an OTP pin to `phone` (canonical
 * 09XXXXXXXX form) — POST /pins?service_name=... per their real,
 * confirmed contract. Always resolves with a usable `pin` to hash and
 * store, even on failure: `success: false` means Resala didn't actually
 * send anything (mock mode, or a genuine API error), so the caller
 * should surface that to the user (e.g. `otpSendFailed`), but there's
 * still a valid code on record to check a resend against rather than
 * leaving the merchant with no way to ever verify.
 */
export async function requestOtpPin(phone: string): Promise<RequestOtpResult> {
  const apiKey = process.env.RESALA_API_KEY;
  const apiUrl = process.env.RESALA_API_URL || RESALA_API_URL_DEFAULT;
  const serviceName = process.env.RESALA_SERVICE_NAME || "رفقة";

  if (!apiKey) {
    const pin = generateFallbackPin();
    console.log(`[sms mock] OTP pin for ${phone}: ${pin}`);
    return { success: true, pin };
  }

  try {
    const res = await fetch(`${apiUrl}/pins?service_name=${encodeURIComponent(serviceName)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone: toResalaInternational(phone) }),
    });
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `Resala API error ${res.status}`);
    }
    const pin = (json as { pin?: string | number }).pin;
    if (pin == null) throw new Error("Resala response missing pin");

    return { success: true, pin: String(pin) };
  } catch (error) {
    console.error("Failed to request Resala OTP pin:", error);
    return { success: false, pin: generateFallbackPin(), error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Sends a pre-approved Resala message template — the only way to send
 * anything other than an OTP pin. `sms_template_id` comes from Resala's
 * dashboard (Templates section) once a template's approved; `vars` fills
 * in its $1/$2/... placeholders, in order.
 */
async function sendTemplateSms(templateId: string, phone: string, vars: string[]): Promise<SendSmsResult> {
  const apiKey = process.env.RESALA_API_KEY;
  const apiUrl = process.env.RESALA_API_URL || RESALA_API_URL_DEFAULT;

  if (!apiKey) {
    console.log(`[sms mock] template=${templateId} to=${phone} vars=${JSON.stringify(vars)}`);
    return { success: true };
  }

  try {
    const record: Record<string, string> = { phone: toResalaInternational(phone) };
    vars.forEach((v, i) => {
      record[`$${i + 1}`] = v;
    });

    const form = new FormData();
    form.set("records", JSON.stringify([record]));

    const res = await fetch(`${apiUrl}/messages/send-template?sms_template_id=${encodeURIComponent(templateId)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}) as Record<string, unknown>);

    if (!res.ok) {
      throw new Error((json as { message?: string }).message ?? `Resala API error ${res.status}`);
    }
    if ((json as { failed?: number }).failed) {
      throw new Error(`Resala reported ${(json as { failed: number }).failed} failed recipient(s)`);
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send Resala template SMS:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function sendNewOrderSms(merchantPhone: string, orderId: string, buyerName: string): Promise<SendSmsResult> {
  const templateId = process.env.RESALA_TEMPLATE_NEW_ORDER_ID;
  if (!templateId) {
    console.log(`[sms mock, no template configured] new order #${orderId} to=${merchantPhone} from=${buyerName}`);
    return { success: true };
  }
  // Convention assumed for this template: $1 = order id, $2 = buyer name.
  // Adjust the vars order here to match however the template is actually
  // written once it's created in Resala's dashboard.
  return sendTemplateSms(templateId, merchantPhone, [orderId, buyerName]);
}

const SHIPMENT_STATUS_MESSAGES: Record<string, string> = {
  accepted: "طلبك في الطريق إلى مركز الشحن!",
  delivered: "تم التسليم بنجاح! شكراً لاستخدامك رفقة",
  failed_delivery: "تعذّر تسليم طلبك، سيتم التواصل معك.",
  returned: "تم إرجاع شحنتك.",
};

export async function sendShipmentStatusSms(buyerPhone: string, status: string, trackingId: string | null): Promise<SendSmsResult> {
  const templateId = process.env.RESALA_TEMPLATE_SHIPMENT_STATUS_ID;
  const message = SHIPMENT_STATUS_MESSAGES[status] ?? `تحديث على طلبك: ${status}`;
  if (!templateId) {
    console.log(`[sms mock, no template configured] shipment status to=${buyerPhone}: ${message} (${trackingId ?? "no tracking id"})`);
    return { success: true };
  }
  // Convention assumed for this template: $1 = status message, $2 = tracking id.
  return sendTemplateSms(templateId, buyerPhone, [message, trackingId ?? ""]);
}
