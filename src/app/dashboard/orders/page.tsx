"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD, type Order } from "@/lib/api";

const statusLabels: Record<Order["status"], string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

const courierStatusLabels: Record<string, string> = {
  accepted: "مستلمة من المخزن",
  delivered: "تم التسليم",
  failed_delivery: "فشل التسليم",
  returned: "مرتجعة",
};

const filters: { value: Order["status"] | "all"; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "قيد الانتظار" },
  { value: "confirmed", label: "مؤكد" },
  { value: "shipped", label: "تم الشحن" },
  { value: "delivered", label: "تم التسليم" },
];

export default function DashboardOrdersPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Order["status"] | "all">("all");

  useEffect(() => {
    if (!token || !store) return;
    api.ordersByStore(token, store.id).then(setOrders);
  }, [token, store]);

  if (!store) return null;

  const visible = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  return (
    <div className="p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">الطلبات</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              filter === f.value ? "bg-harbor text-canvas" : "bg-white/60 text-harbor border border-harbor/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-rope">لا توجد طلبات مطابقة.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-harbor/10 bg-white/50">
          <table className="w-full text-sm text-right">
            <thead className="border-b border-harbor/10 text-rope">
              <tr>
                <th className="px-5 py-3 font-bold">العميل</th>
                <th className="px-5 py-3 font-bold">المدينة</th>
                <th className="px-5 py-3 font-bold">الإجمالي</th>
                <th className="px-5 py-3 font-bold">الدفع</th>
                <th className="px-5 py-3 font-bold">الشحن</th>
                <th className="px-5 py-3 font-bold">الحالة</th>
                <th className="px-5 py-3 font-bold">حالة الشحنة</th>
                <th className="px-5 py-3 font-bold">رقم التتبع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-harbor/5">
              {visible.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-3 font-bold text-harbor">{o.buyerName}</td>
                  <td className="px-5 py-3 text-rope">{o.buyerCity}</td>
                  <td className="px-5 py-3">{formatLYD(o.totalCents)}</td>
                  <td className="px-5 py-3 text-rope">
                    {o.paymentMethod === "cod" ? "عند الاستلام" : o.paymentStatus === "paid" ? "مدفوع" : "قيد الدفع"}
                  </td>
                  <td className="px-5 py-3 text-rope">{o.shippingCents > 0 ? formatLYD(o.shippingCents) : "—"}</td>
                  <td className="px-5 py-3">
                    <span className="stamp h-7 px-3 border-brass text-brass text-xs font-bold">
                      {statusLabels[o.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-rope">{courierStatusLabels[o.courierStatus ?? ""] ?? o.courierStatus ?? "—"}</td>
                  <td className="px-5 py-3 text-rope font-mono" dir="ltr">
                    {o.courierTrackingId ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
