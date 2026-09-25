import { prisma } from "@/lib/prisma";
import { COMMISSION_RATE } from "@/lib/payment/commission";
import { sendBugReportEmail } from "@/lib/integrations/email";
import type { ToolDefinition } from "./anthropic-client";

// Every tool here is scoped to ONE merchant — merchantId always comes from
// the authenticated request (see createSupportTools' own parameter), never
// from the model's tool input, so the agent can never be prompted into
// reading another merchant's data. Read-only except escalate_to_developer.

export const SUPPORT_TOOLS: ToolDefinition[] = [
  {
    name: "get_store_info",
    description: "معلومات متجر التاجر: الاسم، الرابط، شركة الشحن، طرق الدفع المفعّلة، حالة الاشتراك.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_recent_orders",
    description: "آخر الطلبات في متجر التاجر (حتى 10)، مع الحالة وطريقة الدفع والمبلغ.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", description: "فلترة اختيارية بالحالة: pending | confirmed | shipped | delivered | cancelled" } },
    },
  },
  {
    name: "get_order",
    description: "تفاصيل طلب واحد محدد بمعرّفه (orderId) — فقط إذا كان الطلب يخص متجر هذا التاجر.",
    input_schema: { type: "object", properties: { orderId: { type: "string" } }, required: ["orderId"] },
  },
  {
    name: "get_payout_summary",
    description: "ملخص المستحقات المالية للتاجر: المبلغ المعلّق، آخر دفعة، نسبة العمولة.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_subscription_status",
    description: "حالة اشتراك التاجر: الخطة، تاريخ الانتهاء، هل ما زال في الفترة التجريبية.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "escalate_to_developer",
    description:
      "استخدم هذه الأداة فقط عند اكتشاف عطل حقيقي في المنصة (خطأ برمجي، سلوك غير متوقع، شيء معطوب فعليًا) لا يمكن حله بمجرد الشرح أو المعلومات. لا تستخدمها لأسئلة \"كيف أفعل كذا\" التي تستطيع الإجابة عنها بنفسك.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "ملخص قصير للمشكلة (سطر واحد)" },
        details: { type: "string", description: "تفاصيل كاملة: ماذا حدث، ماذا توقع التاجر، أي خطوات لإعادة المشكلة" },
      },
      required: ["summary", "details"],
    },
  },
];

function j(data: unknown): string {
  return JSON.stringify(data);
}

export function createSupportTools(merchantId: string, conversationId: string | null): Record<string, (input: Record<string, unknown>) => Promise<string>> {
  async function requireStore() {
    const store = await prisma.store.findFirst({ where: { merchantId }, orderBy: { createdAt: "asc" } });
    return store;
  }

  return {
    get_store_info: async () => {
      const store = await requireStore();
      if (!store) return j({ error: "لا يوجد متجر بعد لهذا التاجر" });
      return j({
        name: store.name,
        slug: store.slug,
        url: `https://${store.slug}.rifqa.ly`,
        courier: store.courier,
        codEnabled: store.codEnabled,
        walletProvider: store.walletProvider,
        customDomain: store.customDomain,
        customDomainVerified: store.customDomainVerified,
      });
    },

    list_recent_orders: async (input) => {
      const store = await requireStore();
      if (!store) return j({ error: "لا يوجد متجر بعد لهذا التاجر" });
      const status = typeof input.status === "string" ? input.status : undefined;
      const orders = await prisma.order.findMany({
        where: { storeId: store.id, ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, buyerName: true, status: true, paymentMethod: true, paymentStatus: true, totalCents: true, courierTrackingId: true, createdAt: true },
      });
      return j(orders);
    },

    get_order: async (input) => {
      const store = await requireStore();
      if (!store) return j({ error: "لا يوجد متجر بعد لهذا التاجر" });
      const orderId = typeof input.orderId === "string" ? input.orderId : "";
      const order = await prisma.order.findFirst({ where: { id: orderId, storeId: store.id } });
      if (!order) return j({ error: "لم يتم العثور على طلب بهذا المعرّف في متجرك" });
      return j(order);
    },

    get_payout_summary: async () => {
      const [pendingCommissions, payouts] = await Promise.all([
        prisma.commission.findMany({ where: { merchantId, status: "calculated" }, select: { merchantPayoutCents: true } }),
        prisma.payout.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" }, take: 5 }),
      ]);
      const pendingAmountCents = pendingCommissions.reduce((sum, c) => sum + c.merchantPayoutCents, 0);
      return j({ pendingAmountCents, commissionRate: COMMISSION_RATE, recentPayouts: payouts });
    },

    get_subscription_status: async () => {
      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { subscriptionTier: true, subscriptionStatus: true, subscriptionEndDate: true, trialEndsAt: true },
      });
      return j(merchant ?? { error: "not found" });
    },

    escalate_to_developer: async (input) => {
      const summary = typeof input.summary === "string" ? input.summary : "مشكلة غير محددة";
      const details = typeof input.details === "string" ? input.details : "";
      const store = await requireStore();
      const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } });

      const report = await prisma.bugReport.create({
        data: { merchantId, storeId: store?.id ?? null, conversationId, summary, details },
      });

      await sendBugReportEmail({ id: report.id, merchantName: merchant?.name ?? merchantId, summary, details });

      return j({ escalated: true, reportId: report.id, message: "تم تصعيد المشكلة لفريق التطوير — أخبر التاجر أنه سيُتابع معه قريبًا." });
    },
  };
}
