"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD, type Order, type Product } from "@/lib/api";
import { GetStartedChecklist } from "@/components/dashboard/GetStartedChecklist";
import { Icon, type IconName } from "@/components/ui";

export default function DashboardOverviewPage() {
  const { token } = useAuth();
  const { store, stores } = useCurrentStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!token || !store) return;
    api.ordersByStore(token, store.id).then(setOrders);
    api.productsByStore(token, store.id).then(setProducts);
  }, [token, store]);

  if (!store) return null;

  // Cancelled/refunded orders never brought in money — they used to be
  // counted here for COD, since the filter only looked at the payment
  // method.
  const revenueOrders = orders.filter(
    (o) => (o.paymentStatus === "paid" || o.paymentMethod === "cod") && o.status !== "cancelled" && o.status !== "refunded"
  );
  const totalRevenueCents = revenueOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekRevenueCents = revenueOrders.filter((o) => new Date(o.createdAt).getTime() >= weekAgo).reduce((sum, o) => sum + o.totalCents, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const activeProducts = products.filter((p) => p.active).length;
  const lowStockProducts = products.filter((p) => p.trackInventory && p.active && p.stockQty <= p.lowStockThreshold);

  // Layout adapted from 21st.dev's "Activity Stats Card": icon tile,
  // label, the number, and one line of context from data already loaded.
  const stats: { label: string; value: string; sub: string; icon: IconName; tone: string }[] = [
    { label: "إجمالي المبيعات", value: formatLYD(totalRevenueCents), sub: `آخر 7 أيام: ${formatLYD(weekRevenueCents)}`, icon: "wallet", tone: "from-signal to-rose" },
    { label: "عدد الطلبات", value: String(orders.length), sub: pendingOrders > 0 ? `${pendingOrders} بانتظار التأكيد` : "لا طلبات معلّقة", icon: "receipt", tone: "from-harbor to-harbor-deep" },
    { label: "المنتجات النشطة", value: String(activeProducts), sub: `من أصل ${products.length} منتج`, icon: "package", tone: "from-brass to-signal" },
    {
      label: "منتجات على وشك النفاد",
      value: String(lowStockProducts.length),
      sub: lowStockProducts.length > 0 ? "تحتاج إعادة تخزين" : "المخزون بحالة جيدة",
      icon: "alert",
      tone: lowStockProducts.length > 0 ? "from-red-500 to-signal" : "from-green-500 to-green-600",
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-1">نظرة عامة</h1>
      <p className="text-rope mb-8">{store.name}</p>

      <GetStartedChecklist store={store} productCount={products.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="elevation-card flex flex-col gap-3 rounded-2xl border border-harbor/10 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${s.tone}`}>
                <Icon name={s.icon} size={20} />
              </span>
              <p className="text-xs font-bold text-rope sm:text-sm">{s.label}</p>
            </div>
            <p className="font-display text-2xl font-extrabold text-harbor sm:text-3xl whitespace-nowrap">{s.value}</p>
            <p className="text-xs text-rope">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {stores.map((storeItem) => {
          // The subdomain, not the old /store/{slug} path — this is the
          // link merchants are meant to actually share with customers now.
          const storeUrl = `https://${storeItem.slug}.rifqa.ly`;
          return (
            <div key={storeItem.id} className="rounded-2xl border border-harbor/10 bg-white shadow-sm p-6">
              <h3 className="font-bold text-harbor mb-4 text-right">{storeItem.name}</h3>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-brass px-4 text-center font-bold text-harbor transition hover:bg-brass-light active:scale-[0.98]"
                >
                  <Icon name="external" size={18} />
                  عرض المتجر
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(storeUrl);
                    alert("تم نسخ الرابط!");
                  }}
                  className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-harbor/15 px-4 font-bold text-harbor transition hover:bg-harbor/5 active:scale-[0.98]"
                >
                  <Icon name="link" size={18} />
                  نسخ الرابط
                </button>
              </div>
              <p className="mt-3 break-all text-sm text-rope" dir="ltr">
                {storeUrl}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm p-6 mt-8">
        <h2 className="font-bold text-harbor mb-4">أحدث الطلبات</h2>
        {orders.length === 0 ? (
          <p className="text-rope text-sm">لا توجد طلبات بعد.</p>
        ) : (
          <ul className="divide-y divide-harbor/5">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-harbor font-bold">{o.buyerName}</span>
                <span className="text-rope">{formatLYD(o.totalCents)}</span>
                <StatusChip status={o.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Order["status"] }) {
  const labels: Record<Order["status"], string> = {
    pending: "قيد الانتظار",
    confirmed: "مؤكد",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغى",
    refunded: "مسترد",
  };
  return <span className="stamp h-8 px-3 border-brass text-brass text-xs font-bold">{labels[status]}</span>;
}
