/**
 * SMS via Resala (Libyan SMS provider), called with plain `fetch` — no SDK,
 * same pattern as email.ts and the Vanex/DPay integrations. Mocked
 * (console.log) when RESALA_API_KEY is absent.
 *
 * Unlike email.ts's sendEmail(), which swallows all errors because email is
 * a nice-to-have, sendSms() returns a real {success, error} the caller must
 * act on — an OTP the merchant never receives because a send silently
 * failed leaves them stuck with no way to complete signup.
 *
 * Resala's contract here is unverified — built against the shape we have
 * (POST {RESALA_API_URL}/sms/send, JSON {phone, message, sender}, Bearer
 * auth), same situation Vanex was in before real credentials proved several
 * details wrong. Needs live testing once a real, rotated key exists.
 */

const RESALA_API_URL_DEFAULT = "https://dev.resala.ly/api/v1";

export type SendSmsResult = { success: boolean; error?: string };

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

export async function sendSms(phone: string, message: string): Promise<SendSmsResult> {
  const apiKey = process.env.RESALA_API_KEY;
  const apiUrl = process.env.RESALA_API_URL || RESALA_API_URL_DEFAULT;
  const senderId = process.env.RESALA_SENDER_ID || "RIFQA";

  if (!apiKey) {
    console.log(`[sms mock] to=${phone}\n${message}`);
    return { success: true };
  }

  try {
    const res = await fetch(`${apiUrl}/sms/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, message, sender: senderId }),
    });

    if (!res.ok) {
      const responseText = await res.text();
      throw new Error(`Resala API error ${res.status}: ${responseText}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function sendOtpSms(phone: string, code: string): Promise<SendSmsResult> {
  return sendSms(phone, `رفقة - رمز التحقق الخاص بك: ${code}\nلا تشارك هذا الرمز مع أي شخص.`);
}

export async function sendNewOrderSms(merchantPhone: string, orderId: string, buyerName: string): Promise<SendSmsResult> {
  return sendSms(merchantPhone, `طلب جديد #${orderId}\nمن العميل: ${buyerName}`);
}

const SHIPMENT_STATUS_MESSAGES: Record<string, string> = {
  accepted: "طلبك في الطريق إلى مركز الشحن!",
  delivered: "تم التسليم بنجاح! شكراً لاستخدامك رفقة",
  failed_delivery: "تعذّر تسليم طلبك، سيتم التواصل معك.",
  returned: "تم إرجاع شحنتك.",
};

export async function sendShipmentStatusSms(buyerPhone: string, status: string, trackingId: string | null): Promise<SendSmsResult> {
  const message = SHIPMENT_STATUS_MESSAGES[status] ?? `تحديث على طلبك: ${status}`;
  const trackingLine = trackingId ? `\nرقم التتبع: ${trackingId}` : "";
  return sendSms(buyerPhone, `${message}${trackingLine}`);
}
