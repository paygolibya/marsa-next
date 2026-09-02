// Thin fetch wrapper for calling our own /api/* routes from client components.
// Kept deliberately simple — no external HTTP library needed for same-origin
// calls to a Next.js API.

import type { Payout, PlatformStats, MerchantPayoutSummary, CronLog } from "@/types/payment";
import type { DpayPayMethod } from "@/lib/payment/dpay-client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "حدث خطأ غير متوقع", res.status);
  }
  return data as T;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Types mirroring the Prisma models returned by the API ---
export type Merchant = {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  phoneVerified: boolean;
};
export type StoreCustomization = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  logo: string | null;
  tagline: string | null;
  description: string | null;
};
export type Store = {
  id: string;
  merchantId: string;
  name: string;
  slug: string;
  theme: string;
  courier: string;
  codEnabled: boolean;
  walletProvider: string | null;
  currency: string;
  createdAt: string;
  customization?: StoreCustomization | null;
  dpayAvailable?: boolean;
  aboutText: string | null;
  returnPolicy: string | null;
  shippingPolicy: string | null;
  businessHours: string | null;
};
export type Product = {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold: number;
};
export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
};
export type Order = {
  id: string;
  storeId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string | null;
  buyerCity: string;
  buyerAddress: string;
  paymentMethod: "cod" | "wallet";
  paymentStatus: "pending" | "paid" | "failed";
  courierTrackingId: string | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  productSubtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  totalCents: number;
  shippingCents: number;
  courierStatus: string | null;
  courierStatusAt: string | null;
  courierNote: string | null;
  createdAt: string;
  items?: OrderItem[];
};
export type VanexArea = { id: string; name: string; priceCents: number };
export type VanexCity = { id: string; name: string; priceCents: number; areas: VanexArea[] };
export type Coupon = {
  id: string;
  storeId: string;
  code: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  minOrderCents: number | null;
  maxUsage: number | null;
  usageCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};
export type ProductReview = {
  id: string;
  productId: string;
  buyerName: string;
  rating: number;
  reviewText: string | null;
  createdAt: string;
};

export const api = {
  register: (body: { name: string; phone: string; password: string }) =>
    request<{ token: string; merchant: Merchant; otpSendFailed: boolean }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { phone: string; password: string }) =>
    request<{ token: string; merchant: Merchant }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: (token: string) => request<{ merchant: Merchant }>("/api/auth/me", { headers: authHeaders(token) }),

  verifyOtp: (token: string, code: string) =>
    request<{ merchant: Merchant }>("/api/auth/verify-otp", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ code }),
    }),

  resendOtp: (token: string) =>
    request<{ success: boolean }>("/api/auth/resend-otp", {
      method: "POST",
      headers: authHeaders(token),
    }),

  createStore: (
    token: string,
    body: { name: string; theme?: string; courier?: string; codEnabled?: boolean; walletProvider?: string | null; templateId?: string | null }
  ) =>
    request<Store>("/api/stores", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  myStores: (token: string) =>
    request<Store[]>("/api/stores/mine", { headers: authHeaders(token) }),

  publicStore: (slug: string) =>
    request<{ store: Store; products: Product[] }>(`/api/stores/public/${slug}`),

  createProduct: (
    token: string,
    body: { storeId: string; name: string; priceCents: number; imageUrl?: string | null }
  ) =>
    request<Product>("/api/products", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  productsByStore: (token: string, storeId: string) =>
    request<Product[]>(`/api/products/by-store/${storeId}`, { headers: authHeaders(token) }),

  bulkImportProducts: async (token: string, storeId: string, file: File) => {
    const formData = new FormData();
    formData.append("storeId", storeId);
    formData.append("file", file);
    const res = await fetch("/api/products/bulk-import", {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "فشل الاستيراد", res.status);
    return data as { createdCount: number; errors: { row: number; message: string }[] };
  },

  deleteProduct: (token: string, id: string) =>
    request<{ ok: boolean }>(`/api/products/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  updateProduct: (
    token: string,
    id: string,
    body: Partial<{
      name: string;
      priceCents: number;
      imageUrl: string | null;
      active: boolean;
      trackInventory: boolean;
      stockQty: number;
      lowStockThreshold: number;
    }>
  ) =>
    request<Product>(`/api/products/${id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  updateStoreSettings: (
    token: string,
    id: string,
    body: Partial<{ aboutText: string | null; returnPolicy: string | null; shippingPolicy: string | null; businessHours: string | null }>
  ) =>
    request<Store>(`/api/stores/${id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),

  createOrder: (body: {
    storeSlug: string;
    items: { productId: string; quantity: number }[];
    buyer: { name: string; phone: string; email?: string; city: string; address: string; vanexAreaId?: string };
    paymentMethod: "cod" | "wallet";
    dpayPayMethod?: DpayPayMethod;
    dpayCustomerMobile?: string;
    dpayBirthYear?: string;
    dpayCardNumber?: string;
    couponCode?: string;
  }) =>
    request<{
      orderId: string;
      totalCents: number;
      shippingCents: number;
      discountCents: number;
      trackingId?: string;
      courier?: string;
      paymentStatus: string;
      dpay?: { sessionId: number; payMethod: DpayPayMethod; requiresOtp: boolean; paymentLink?: string };
    }>("/api/orders", { method: "POST", body: JSON.stringify(body) }),

  dpayVerifyOtp: (orderId: string, otp: string) =>
    request<{ status: string; trackingId?: string; courier?: string; error?: string }>("/api/dpay/verify-otp", {
      method: "POST",
      body: JSON.stringify({ orderId, otp }),
    }),

  ordersByStore: (token: string, storeId: string) =>
    request<Order[]>(`/api/orders/by-store/${storeId}`, { headers: authHeaders(token) }),

  vanexCities: () => request<{ cities: VanexCity[] }>("/api/vanex/cities"),

  validateCoupon: (body: { storeSlug: string; code: string; subtotalCents: number }) =>
    request<{ valid: boolean; discountCents: number; message?: string }>("/api/orders/validate-coupon", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createCoupon: (
    token: string,
    body: {
      storeId: string;
      code: string;
      discountType: "percent" | "fixed";
      discountValue: number;
      minOrderCents?: number | null;
      maxUsage?: number | null;
      expiresAt?: string | null;
    }
  ) => request<Coupon>("/api/coupons", { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) }),

  listCoupons: (token: string, storeId: string) =>
    request<Coupon[]>(`/api/coupons?storeId=${storeId}`, { headers: authHeaders(token) }),

  updateCoupon: (token: string, id: string, body: Partial<{ active: boolean; maxUsage: number | null; expiresAt: string | null }>) =>
    request<Coupon>(`/api/coupons/${id}`, { method: "PATCH", headers: authHeaders(token), body: JSON.stringify(body) }),

  deleteCoupon: (token: string, id: string) =>
    request<{ ok: boolean }>(`/api/coupons/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  trackOrder: (orderId: string, phone: string) =>
    request<{
      status: Order["status"];
      courierStatus: string | null;
      courierStatusAt: string | null;
      courierNote: string | null;
      courierTrackingId: string | null;
      totalCents: number;
      shippingCents: number;
      createdAt: string;
      items: OrderItem[];
    }>(`/api/orders/track?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`),

  productReviews: (productId: string) => request<{ reviews: ProductReview[]; average: number; count: number }>(`/api/products/${productId}/reviews`),

  submitReview: (body: { productId: string; orderId: string; phone: string; buyerName: string; rating: number; reviewText?: string }) =>
    request<ProductReview>(`/api/products/${body.productId}/reviews`, { method: "POST", body: JSON.stringify(body) }),

  analytics: (token: string, storeId: string, days = 30) =>
    request<{
      byDay: { date: string; orders: number; revenueCents: number }[];
      topProducts: { name: string; quantity: number; revenueCents: number }[];
    }>(`/api/analytics/by-store/${storeId}?days=${days}`, { headers: authHeaders(token) }),

  adminPayouts: (token: string, status?: string) =>
    request<{ stats: PlatformStats; payouts: Payout[] }>(`/api/admin/payouts/ready${status ? `?status=${status}` : ""}`, {
      headers: authHeaders(token),
    }),

  transferPayout: (token: string, payoutId: string, opts?: { transferReference?: string; note?: string }) =>
    request<Payout>("/api/admin/payouts/transfer", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ payoutId, ...opts }),
    }),

  adminCronLogs: (token: string) =>
    request<{ logs: CronLog[] }>("/api/admin/cron-logs", { headers: authHeaders(token) }),

  merchantPayouts: (token: string) =>
    request<MerchantPayoutSummary>("/api/merchant/payouts", { headers: authHeaders(token) }),
};

export function formatLYD(cents: number): string {
  return `${(cents / 100).toLocaleString("ar-LY", { minimumFractionDigits: 2 })} د.ل`;
}
