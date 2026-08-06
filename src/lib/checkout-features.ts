export type SubscriptionTier = "basic" | "professional" | "advanced";

export interface SubscriptionState {
  tier: SubscriptionTier;
  monthlyPrice: number;
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

export const subscriptionPlans = {
  basic: {
    id: "basic",
    name: "المبتدئ",
    displayName: "المبتدئ (Basic)",
    price: 150,
    monthlyOrders: "حتى 50 طلب/شهر",
    directWire: true,
    receiptUpload: true,
    cod: true,
    dpay: false,
    multiplePayments: false,
    apiAccess: false,
    analytics: false,
    prioritySupport: false,
    description: "خطة مناسبة للمتاجر الصغيرة مع طرق دفع يدويّة فقط",
    checkoutMessage: "✅ Basic Plan - Manual Payments\nDirect wire, cash on delivery, receipt upload\n📌 Limited to manual payment methods",
  },
  professional: {
    id: "professional",
    name: "المتقدم",
    displayName: "المتقدم (Professional)",
    price: 280,
    monthlyOrders: "حتى 500 طلب/شهر",
    directWire: true,
    receiptUpload: true,
    cod: true,
    dpay: "select_one",
    multiplePayments: false,
    apiAccess: false,
    analytics: false,
    prioritySupport: false,
    description: "اختر طريقة دفع واحدة: DPay أو تحويل بنكي مباشر",
    checkoutMessage: "⚡ Professional Plan - Automate One Method\nChoose DPay OR Direct Transfer\nInstant payment processing + automated verification\n🔒 Upgrade to Advanced for all payment methods",
  },
  advanced: {
    id: "advanced",
    name: "الاحترافي",
    displayName: "الاحترافي (Advanced)",
    price: 450,
    monthlyOrders: "غير محدود",
    directWire: true,
    receiptUpload: true,
    cod: true,
    dpay: true,
    multiplePayments: true,
    apiAccess: true,
    analytics: true,
    prioritySupport: true,
    description: "الحد الأقصى من طرق الدفع والتحليلات المتقدمة",
    checkoutMessage: "🚀 Advanced Plan - Maximum Conversions\nAll payment methods active\nDPay + Direct Wire + COD simultaneously\nAdvanced analytics & API access",
  },
} as const;

export function getCheckoutPaymentMethods(subscription: SubscriptionState) {
  const paymentMethods = {
    directWire: true,
    receiptUpload: true,
    cod: true,
    dpay: false,
  };

  if (subscription.tier === "basic") {
    return paymentMethods;
  }

  if (subscription.tier === "professional") {
    if (subscription.selectedPaymentMethod === "dpay" && subscription.dpayEnabled) {
      paymentMethods.dpay = true;
      paymentMethods.directWire = false;
    } else if (subscription.selectedPaymentMethod === "direct_transfer") {
      paymentMethods.directWire = true;
    }
    return paymentMethods;
  }

  if (subscription.tier === "advanced") {
    paymentMethods.dpay = subscription.dpayEnabled;
    paymentMethods.directWire = true;
    paymentMethods.receiptUpload = true;
    paymentMethods.cod = true;
  }

  return paymentMethods;
}

export function getSubscriptionState(merchant: { subscriptionTier?: string | null; directWireEnabled?: boolean | null; receiptUploadEnabled?: boolean | null; codEnabled?: boolean | null; dpayEnabled?: boolean | null; allowMultiplePaymentMethods?: boolean | null; apiAccessEnabled?: boolean | null; selectedPaymentMethod?: string | null; subscriptionEndDate?: Date | string | null }): SubscriptionState {
  const tier = normalizeSubscriptionTier(merchant.subscriptionTier);
  const plan = subscriptionPlans[tier] ?? subscriptionPlans.basic;

  return {
    tier,
    monthlyPrice: plan.price,
    directWireEnabled: merchant.directWireEnabled ?? plan.directWire,
    receiptUploadEnabled: merchant.receiptUploadEnabled ?? plan.receiptUpload,
    codEnabled: merchant.codEnabled ?? plan.cod,
    dpayEnabled: merchant.dpayEnabled ?? Boolean(plan.dpay),
    allowMultiplePaymentMethods: merchant.allowMultiplePaymentMethods ?? plan.multiplePayments,
    apiAccessEnabled: merchant.apiAccessEnabled ?? plan.apiAccess,
    selectedPaymentMethod: merchant.selectedPaymentMethod ?? null,
  };
}
