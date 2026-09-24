"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, formatLYD } from "@/lib/api";
import type { MerchantPayoutSummary } from "@/types/payment";
import { Badge, Card, DataTable, type DataTableColumn, EmptyState, Skeleton, SkeletonCard } from "@/components/ui";

const STATUS_LABELS: Record<string, string> = {
  ready_for_transfer: "قيد الانتظار",
  transferred: "تم التحويل",
};

type PayoutRow = MerchantPayoutSummary["history"][number];

export default function PayoutDashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<MerchantPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api
      .merchantPayouts(token)
      .then(setSummary)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-10">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }
  if (!summary) return null;

  const columns: DataTableColumn<PayoutRow>[] = [
    {
      key: "period",
      header: "الفترة",
      accessor: (p) => p.periodStart,
      sortable: true,
      render: (p) => `${new Date(p.periodStart).toLocaleDateString("ar-LY")} – ${new Date(p.periodEnd).toLocaleDateString("ar-LY")}`,
    },
    { key: "orderCount", header: "عدد الطلبات", accessor: (p) => p.orderCount, sortable: true },
    { key: "totalSalesCents", header: "إجمالي المبيعات", accessor: (p) => p.totalSalesCents, sortable: true, render: (p) => formatLYD(p.totalSalesCents) },
    { key: "commissionCents", header: "العمولة", render: (p) => formatLYD(p.commissionCents) },
    { key: "amountCents", header: "المستحق", accessor: (p) => p.amountCents, sortable: true, render: (p) => <span className="font-bold text-harbor">{formatLYD(p.amountCents)}</span> },
    {
      key: "status",
      header: "الحالة",
      render: (p) => <Badge tone={p.status === "transferred" ? "success" : "warning"}>{STATUS_LABELS[p.status] ?? p.status}</Badge>,
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">المستحقات المالية</h1>
      <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        ⚡ تُحتسب مستحقاتك تلقائيًا فور تسليم كل طلب — لا حاجة لأي إجراء من طرفك. تصلك 99% من قيمة كل عملية بيع
        عبر المحفظة الإلكترونية، وتُجمَّع الدفعات أسبوعيًا استعدادًا للتحويل.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
        <Card className="p-6">
          <p className="text-rope text-sm">المستحقات المعلّقة</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{formatLYD(summary.pendingAmountCents)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-rope text-sm">آخر دفعة</p>
          {summary.lastPayout ? (
            <>
              <p className="font-display text-3xl font-extrabold text-harbor mt-2">{formatLYD(summary.lastPayout.amountCents)}</p>
              <p className="text-xs text-rope mt-1">
                {summary.lastPayout.transferredAt ? new Date(summary.lastPayout.transferredAt).toLocaleDateString("ar-LY") : "—"}
              </p>
            </>
          ) : (
            <p className="text-rope mt-2">لا توجد دفعات بعد</p>
          )}
        </Card>
        <Card className="p-6">
          <p className="text-rope text-sm">نسبة عمولة رفقة (رسوم الدفع الإلكتروني)</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{(summary.commissionRate * 100).toFixed(0)}%</p>
          <p className="text-xs text-rope mt-1">تحصل على {(100 - summary.commissionRate * 100).toFixed(0)}% من كل عملية بيع</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-bold text-harbor mb-4">سجل الدفعات</h2>
        <DataTable
          columns={columns}
          rows={summary.history}
          rowKey={(p) => p.id}
          pageSize={10}
          emptyState={<EmptyState title="لا توجد دفعات بعد" />}
        />
      </Card>
    </div>
  );
}
