// One platform plan — every merchant gets the full feature set (all
// payment methods, API access, analytics, priority support). What used
// to vary was three tiers with different FEATURES (basic/professional/
// advanced); what varies now is only the BILLING PERIOD (1/3/12 months)
// — see subscriptionPeriods below. `SubscriptionTier` is kept only for
// backward compatibility with data already in the DB (Merchant.subscriptionTier,
// Payment.tier) and the admin's legacy manual-accept picker
// (src/app/admin/merchants/page.tsx) — it no longer affects which
// features a merchant gets.
export type SubscriptionTier = "basic" | "professional" | "advanced";

export interface SubscriptionState {
  tier: SubscriptionTier;
  directWireEnabled: boolean;
  receiptUploadEnabled: boolean;
  codEnabled: boolean;
  dpayEnabled: boolean;
  allowMultiplePaymentMethods: boolean;
  apiAccessEnabled: boolean;
  selectedPaymentMethod?: string | null;
}

export function normalizeSubscriptionTier(tier?: string | null): SubscriptionTier {
  if (tier === "professional" || tier === "advanced") return tier;
  return "basic";
}

// The merchant.* boolean feature flags (dpayEnabled, apiAccessEnabled, ...)
// have real (non-null) defaults in the DB, so they never fall back to
// this on their own — this must be applied explicitly whenever a
// merchant's subscription activates (registration, DPay payment,
// admin approval) or the flags just stay at their defaults forever.
// Every tier now maps to the same full feature set — kept as a function
// of `tier` (rather than a bare constant) only so every existing call
// site (register, dpay-subscription, admin approve/accept) keeps
// working unchanged.
export function getPlanFeatureFlags(_tier?: string | null) {
  return {
    directWireEnabled: true,
    receiptUploadEnabled: true,
    codEnabled: true,
    dpayEnabled: true,
    allowMultiplePaymentMethods: true,
    apiAccessEnabled: true,
  };
}

export function getCheckoutPaymentMethods(_subscription: SubscriptionState) {
  // Every merchant's storefront offers every payment method to their own
  // buyers now — no more tier-gated "choose one automated method".
  return { directWire: true, receiptUpload: true, cod: true, dpay: true };
}

export function getSubscriptionState(merchant: { subscriptionTier?: string | null; directWireEnabled?: boolean | null; receiptUploadEnabled?: boolean | null; codEnabled?: boolean | null; dpayEnabled?: boolean | null; allowMultiplePaymentMethods?: boolean | null; apiAccessEnabled?: boolean | null; selectedPaymentMethod?: string | null; subscriptionEndDate?: Date | string | null }): SubscriptionState {
  const tier = normalizeSubscriptionTier(merchant.subscriptionTier);
  const flags = getPlanFeatureFlags(tier);

  return {
    tier,
    directWireEnabled: merchant.directWireEnabled ?? flags.directWireEnabled,
    receiptUploadEnabled: merchant.receiptUploadEnabled ?? flags.receiptUploadEnabled,
    codEnabled: merchant.codEnabled ?? flags.codEnabled,
    dpayEnabled: merchant.dpayEnabled ?? flags.dpayEnabled,
    allowMultiplePaymentMethods: merchant.allowMultiplePaymentMethods ?? flags.allowMultiplePaymentMethods,
    apiAccessEnabled: merchant.apiAccessEnabled ?? flags.apiAccessEnabled,
    selectedPaymentMethod: merchant.selectedPaymentMethod ?? null,
  };
}

// ---------------------------------------------------------------------
// Billing periods — the one axis that actually varies now.
// ---------------------------------------------------------------------

export type SubscriptionPeriod = "1m" | "3m" | "12m";

export interface SubscriptionPeriodInfo {
  id: SubscriptionPeriod;
  months: number;
  label: string;
  totalPriceLYD: number;
  monthlyEquivalentLYD: number;
  tagline: string;
  savingsLabel: string | null;
  badge: string | null;
}

export const subscriptionPeriods: Record<SubscriptionPeriod, SubscriptionPeriodInfo> = {
  "1m": {
    id: "1m",
    months: 1,
    label: "شهر واحد",
    totalPriceLYD: 150,
    monthlyEquivalentLYD: 150,
    tagline: "مرونة شهرية — ألغِ في أي وقت",
    savingsLabel: null,
    badge: null,
  },
  "3m": {
    id: "3m",
    months: 3,
    label: "3 أشهر",
    totalPriceLYD: 400,
    monthlyEquivalentLYD: 133,
    tagline: "الأفضل لتجربة المنصة",
    savingsLabel: "وفّر 50 د.ل (22%)",
    badge: "الأفضل قيمة",
  },
  "12m": {
    id: "12m",
    months: 12,
    label: "سنة كاملة",
    totalPriceLYD: 1500,
    monthlyEquivalentLYD: 125,
    tagline: "الأفضل للالتزام طويل المدى",
    savingsLabel: "وفّر 300 د.ل (20%)",
    badge: "الأفضل قيمة سنوية",
  },
};

export function normalizeSubscriptionPeriod(period?: string | null): SubscriptionPeriod {
  if (period === "3m" || period === "12m") return period;
  return "1m";
}

// The single "what's included" checklist — the same for every period
// since there's only one plan now. Shared by the homepage pricing
// section and /subscription so the two never drift apart.
export const PLATFORM_FEATURES: string[] = [
  "طرق دفع جاهزة: DPay (معاملات، ساحارة باي، سداد، إدفعلي) + الدفع عند الاستلام",
  "شحن جاهز عبر فانكس: إنشاء شحنة تلقائي وتتبع لحظي",
  "رسائل SMS وبريد إلكتروني جاهزة: تحقق وإشعارات وتأكيدات",
  "منتجات وطلبات ومبيعات غير محدودة",
  "لوحة تحكم احترافية وإدارة كاملة للطلبات والتوصيل والمخزون",
  "نطاق فرعي مجاني (متجرك.rifqa.ly) ودعم ربط نطاق مخصص",
  "دعم مباشر على مدار الساعة بالعربية والإنجليزية",
];
