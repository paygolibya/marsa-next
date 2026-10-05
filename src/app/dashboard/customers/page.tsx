"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD, type Customer } from "@/lib/api";
import { DataTable, type DataTableColumn, EmptyState, SkeletonRow } from "@/components/ui";

// Read-only — every row here is derived from real Order history (see the
// Customer upsert inside /api/orders' own transaction), never something a
// merchant adds or edits directly.
export default function DashboardCustomersPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [customers, setCustomers] = useState<Customer[] | null>(null);

  useEffect(() => {
    if (!token || !store) return;
    api.listCustomers(token, store.id).then(setCustomers);
  }, [token, store]);

  if (!store) return null;

  const columns: DataTableColumn<Customer>[] = [
    { key: "name", header: "الاسم", accessor: (c) => c.name, sortable: true, render: (c) => <span className="font-bold text-harbor">{c.name}</span> },
    { key: "phone", header: "الهاتف", accessor: (c) => c.phone, render: (c) => <span dir="ltr">{c.phone}</span> },
    { key: "city", header: "المدينة", accessor: (c) => c.city ?? "", render: (c) => c.city ?? "—" },
    { key: "orderCount", header: "عدد الطلبات", accessor: (c) => c.orderCount, sortable: true },
    { key: "totalSpentCents", header: "إجمالي الشراء", accessor: (c) => c.totalSpentCents, sortable: true, render: (c) => formatLYD(c.totalSpentCents) },
    {
      key: "lastOrderAt",
      header: "آخر طلب",
      accessor: (c) => c.lastOrderAt,
      sortable: true,
      render: (c) => new Date(c.lastOrderAt).toLocaleDateString("ar-LY"),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">العملاء</h1>

      {customers === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={6} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={customers}
          rowKey={(c) => c.id}
          searchPlaceholder="ابحث عن عميل..."
          searchText={(c) => `${c.name} ${c.phone}`}
          pageSize={20}
          emptyState={<EmptyState title="لا يوجد عملاء بعد" description="سيظهر عملاؤك هنا تلقائيًا بعد أول طلب حقيقي." />}
        />
      )}
    </div>
  );
}
