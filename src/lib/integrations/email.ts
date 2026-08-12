/**
 * Order confirmation + status-change emails via SendGrid, called with plain
 * `fetch` — no SDK dependency, same pattern as the Vanex/DPay integrations
 * in this file's siblings. Mocked (console.log) when SENDGRID_API_KEY is
 * absent, so dev/CI never needs real credentials, and email is opt-in per
 * order (buyerEmail is optional) — a missing address is a silent no-op,
 * not an error.
 */

const SENDGRID_API_URL = "https://api.sendgrid.com/v3/mail/send";

export type EmailOrder = {
  id: string;
  buyerName: string;
  buyerEmail: string | null;
  totalCents: number;
  courierTrackingId?: string | null;
};

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log(`[email mock] to=${to} subject="${subject}"\n${text}`);
    return;
  }

  try {
    const res = await fetch(SENDGRID_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail },
        subject,
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!res.ok) {
      const responseText = await res.text();
      throw new Error(`SendGrid API error ${res.status}: ${responseText}`);
    }
  } catch (error) {
    // Email is a nice-to-have on top of a successful order — never let a
    // provider outage fail the checkout/webhook that triggered it.
    console.error("Failed to send email:", error);
  }
}

function formatLYD(cents: number): string {
  return `${(cents / 100).toFixed(2)} د.ل`;
}

export async function sendOrderConfirmationEmail(order: EmailOrder): Promise<void> {
  if (!order.buyerEmail) return;
  const lines = [
    `مرحبًا ${order.buyerName}،`,
    `تم تأكيد طلبك رقم ${order.id}.`,
    `الإجمالي: ${formatLYD(order.totalCents)}`,
    order.courierTrackingId ? `رقم التتبع: ${order.courierTrackingId}` : "",
    `يمكنك متابعة حالة طلبك في أي وقت عبر: /track?orderId=${order.id}`,
  ].filter(Boolean);
  await sendEmail(order.buyerEmail, "تم تأكيد طلبك", lines.join("\n"));
}

const STATUS_MESSAGES: Record<string, string> = {
  accepted: "تم استلام شحنتك من قبل شركة الشحن.",
  delivered: "تم تسليم طلبك بنجاح.",
  failed_delivery: "تعذّر تسليم طلبك، سيتم التواصل معك.",
  returned: "تم إرجاع شحنتك.",
};

export async function sendOrderStatusEmail(order: EmailOrder, newStatus: string): Promise<void> {
  if (!order.buyerEmail) return;
  const message = STATUS_MESSAGES[newStatus] ?? `تحديث على طلبك: ${newStatus}`;
  const lines = [`مرحبًا ${order.buyerName}،`, message, `رقم الطلب: ${order.id}`];
  await sendEmail(order.buyerEmail, "تحديث على طلبك", lines.join("\n"));
}
