"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type Inquiry } from "@/lib/api";
import { DataTable, type DataTableColumn, EmptyState, SkeletonRow, useToast } from "@/components/ui";

export default function DashboardInquiriesPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !store) return;
    setInquiries(null);
    api.inquiriesByStore(token, store.id).then(setInquiries);
  }, [token, store]);

  if (!store) return null;

  async function handleMarkHandled(inquiry: Inquiry) {
    if (!token || markingId) return;
    setMarkingId(inquiry.id);
    try {
      await api.markInquiryHandled(token, inquiry.id);
      setInquiries((prev) => prev?.map((i) => (i.id === inquiry.id ? { ...i, handled: true } : i)) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تحديث الاستفسار", "error");
    } finally {
      setMarkingId(null);
    }
  }

  const columns: DataTableColumn<Inquiry>[] = [
    { key: "buyerName", header: "الاسم", accessor: (i) => i.buyerName, sortable: true, render: (i) => <span className="font-bold text-harbor">{i.buyerName}</span> },
    {
      key: "buyerPhone",
      header: "الهاتف",
      render: (i) => (
        <span className="font-mono" dir="ltr">
          {i.buyerPhone}
        </span>
      ),
    },
    { key: "product", header: "المنتج", render: (i) => i.product?.name ?? "—" },
    { key: "message", header: "الرسالة", render: (i) => <span className="line-clamp-2 max-w-sm block">{i.message}</span> },
    {
      key: "createdAt",
      header: "التاريخ",
      accessor: (i) => i.createdAt,
      sortable: true,
      render: (i) => new Date(i.createdAt).toLocaleDateString("ar-LY"),
    },
    {
      key: "status",
      header: "الحالة",
      render: (i) =>
        i.handled ? (
          <span className="stamp h-7 px-3 border-green-600 text-green-700 text-xs font-bold">تم التعامل معه</span>
        ) : (
          <button
            onClick={() => handleMarkHandled(i)}
            disabled={markingId === i.id}
            className="text-xs font-bold text-harbor hover:underline disabled:opacity-50"
          >
            {markingId === i.id ? "جارٍ الحفظ..." : "تم التعامل معه؟"}
          </button>
        ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">الاستفسارات</h1>

      {inquiries === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} columns={6} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={inquiries}
          rowKey={(i) => i.id}
          searchPlaceholder="ابحث باسم العميل أو رقم الهاتف..."
          searchText={(i) => `${i.buyerName} ${i.buyerPhone}`}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد استفسارات حتى الآن" />}
        />
      )}
    </div>
  );
}
