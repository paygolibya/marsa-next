"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, formatLYD } from "@/lib/api";
import type { MerchantPayoutSummary } from "@/types/payment";

const STATUS_LABELS: Record<string, string> = {
  ready_for_transfer: "قيد الانتظار",
  transferred: "تم التحويل",
};

const STATUS_CLASSES: Record<string, string> = {
  ready_for_transfer: "bg-yellow-100 text-yellow-800",
  transferred: "bg-green-100 text-green-800",
};

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

  if (loading) return <p className="p-10 text-rope">جارٍ التحميل...</p>;
  if (!summary) return null;

  return (
    <div className="p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-2">المستحقات المالية</h1>
      <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        ⚡ تُحتسب مستحقاتك تلقائيًا فور تسليم كل طلب — لا حاجة لأي إجراء من طرفك. تصلك 99% من قيمة كل عملية بيع
        عبر المحفظة الإلكترونية، وتُجمَّع الدفعات أسبوعيًا استعدادًا للتحويل.
      </p>

      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
          <p className="text-rope text-sm">المستحقات المعلّقة</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{formatLYD(summary.pendingAmountCents)}</p>
        </div>
        <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
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
        </div>
        <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
          <p className="text-rope text-sm">نسبة عمولة رفقة (رسوم الدفع الإلكتروني)</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{(summary.commissionRate * 100).toFixed(0)}%</p>
          <p className="text-xs text-rope mt-1">تحصل على {(100 - summary.commissionRate * 100).toFixed(0)}% من كل عملية بيع</p>
        </div>
      </div>

      <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
        <h2 className="font-bold text-harbor mb-4">سجل الدفعات</h2>
        {summary.history.length === 0 ? (
          <p className="text-rope text-sm">لا توجد دفعات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="border-b border-harbor/10 text-rope">
                <tr>
                  <th className="px-4 py-3 font-bold">الفترة</th>
                  <th className="px-4 py-3 font-bold">عدد الطلبات</th>
                  <th className="px-4 py-3 font-bold">إجمالي المبيعات</th>
                  <th className="px-4 py-3 font-bold">العمولة</th>
                  <th className="px-4 py-3 font-bold">المستحق</th>
                  <th className="px-4 py-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-harbor/5">
                {summary.history.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 text-rope">
                      {new Date(p.periodStart).toLocaleDateString("ar-LY")} – {new Date(p.periodEnd).toLocaleDateString("ar-LY")}
                    </td>
                    <td className="px-4 py-3">{p.orderCount}</td>
                    <td className="px-4 py-3">{formatLYD(p.totalSalesCents)}</td>
                    <td className="px-4 py-3">{formatLYD(p.commissionCents)}</td>
                    <td className="px-4 py-3 font-bold text-harbor">{formatLYD(p.amountCents)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_CLASSES[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
