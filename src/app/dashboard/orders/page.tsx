"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD, type Order } from "@/lib/api";
import { DataTable, type DataTableColumn, EmptyState, SkeletonRow } from "@/components/ui";

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
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<Order["status"] | "all">("all");

  useEffect(() => {
    if (!token || !store) return;
    setOrders(null);
    api.ordersByStore(token, store.id).then(setOrders);
  }, [token, store]);

  if (!store) return null;

  const visible = orders === null ? [] : filter === "all" ? orders : orders.filter((o) => o.status === filter);

  const columns: DataTableColumn<Order>[] = [
    { key: "buyerName", header: "العميل", accessor: (o) => o.buyerName, sortable: true, render: (o) => <span className="font-bold text-harbor">{o.buyerName}</span> },
    { key: "buyerCity", header: "المدينة", accessor: (o) => o.buyerCity },
    { key: "totalCents", header: "الإجمالي", accessor: (o) => o.totalCents, sortable: true, render: (o) => formatLYD(o.totalCents) },
    {
      key: "payment",
      header: "الدفع",
      render: (o) => (o.paymentMethod === "cod" ? "عند الاستلام" : o.paymentStatus === "paid" ? "مدفوع" : "قيد الدفع"),
    },
    { key: "shipping", header: "الشحن", render: (o) => (o.shippingCents > 0 ? formatLYD(o.shippingCents) : "—") },
    {
      key: "status",
      header: "الحالة",
      render: (o) => <span className="stamp h-7 px-3 border-brass text-brass text-xs font-bold">{statusLabels[o.status]}</span>,
    },
    { key: "courierStatus", header: "حالة الشحنة", render: (o) => courierStatusLabels[o.courierStatus ?? ""] ?? o.courierStatus ?? "—" },
    {
      key: "trackingId",
      header: "رقم التتبع",
      render: (o) => (
        <span className="font-mono" dir="ltr">
          {o.courierTrackingId ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">الطلبات</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              filter === f.value ? "bg-harbor text-canvas" : "bg-white text-harbor border border-harbor/10 shadow-sm"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} columns={6} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(o) => o.id}
          searchPlaceholder="ابحث باسم العميل أو المدينة..."
          searchText={(o) => `${o.buyerName} ${o.buyerCity}`}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد طلبات مطابقة" />}
        />
      )}
    </div>
  );
}
