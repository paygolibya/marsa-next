// Thin fetch wrapper for calling our own /api/* routes from client components.
// Kept deliberately simple — no external HTTP library needed for same-origin
// calls to a Next.js API.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "حدث خطأ غير متوقع", res.status);
  }
  return data as T;
}

function authHeaders(token: string | null) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- Types mirroring the Prisma models returned by the API ---
export type Merchant = { id: string; name: string; phone: string };
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
};
export type Product = {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
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
  buyerCity: string;
  buyerAddress: string;
  paymentMethod: "cod" | "wallet";
  paymentStatus: "pending" | "paid" | "failed";
  courierTrackingId: string | null;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  totalCents: number;
  createdAt: string;
  items?: OrderItem[];
};

export const api = {
  register: (body: { name: string; phone: string; password: string }) =>
    request<{ token: string; merchant: Merchant }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { phone: string; password: string }) =>
    request<{ token: string; merchant: Merchant }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createStore: (
    token: string,
    body: { name: string; theme?: string; courier?: string; codEnabled?: boolean; walletProvider?: string | null }
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

  deleteProduct: (token: string, id: string) =>
    request<{ ok: boolean }>(`/api/products/${id}`, { method: "DELETE", headers: authHeaders(token) }),

  createOrder: (body: {
    storeSlug: string;
    items: { productId: string; quantity: number }[];
    buyer: { name: string; phone: string; city: string; address: string };
    paymentMethod: "cod" | "wallet";
  }) =>
    request<{ orderId: string; totalCents: number; trackingId: string; courier: string; paymentStatus: string }>(
      "/api/orders",
      { method: "POST", body: JSON.stringify(body) }
    ),

  ordersByStore: (token: string, storeId: string) =>
    request<Order[]>(`/api/orders/by-store/${storeId}`, { headers: authHeaders(token) }),
};

export function formatLYD(cents: number): string {
  return `${(cents / 100).toLocaleString("ar-LY", { minimumFractionDigits: 2 })} د.ل`;
}
