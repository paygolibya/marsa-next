"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD, type Order, type Product } from "@/lib/api";

export default function DashboardOverviewPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!token || !store) return;
    api.ordersByStore(token, store.id).then(setOrders);
    api.productsByStore(token, store.id).then(setProducts);
  }, [token, store]);

  if (!store) return null;

  const totalRevenueCents = orders
    .filter((o) => o.paymentStatus === "paid" || o.paymentMethod === "cod")
    .reduce((sum, o) => sum + o.totalCents, 0);
  const activeProducts = products.filter((p) => p.active).length;

  const stats = [
    { label: "إجمالي المبيعات", value: formatLYD(totalRevenueCents) },
    { label: "عدد الطلبات", value: String(orders.length) },
    { label: "المنتجات النشطة", value: String(activeProducts) },
  ];

  return (
    <div className="p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-1">نظرة عامة</h1>
      <p className="text-rope mb-8">{store.name}</p>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
            <p className="text-rope text-sm">{s.label}</p>
            <p className="font-display text-3xl font-extrabold text-harbor mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
        <h2 className="font-bold text-harbor mb-4">أحدث الطلبات</h2>
        {orders.length === 0 ? (
          <p className="text-rope text-sm">لا توجد طلبات بعد.</p>
        ) : (
          <ul className="divide-y divide-harbor/5">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className="py-3 flex items-center justify-between text-sm">
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
  };
  return <span className="stamp h-8 px-3 border-brass text-brass text-xs font-bold">{labels[status]}</span>;
}
