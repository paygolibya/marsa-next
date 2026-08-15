"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, formatLYD } from "@/lib/api";
import type { Payout, PlatformStats } from "@/types/payment";

const STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  processing: "قيد التحويل",
  completed: "مكتمل",
};

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
};

function toCsv(payouts: Payout[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Merchant", "Period Start", "Period End", "Orders", "Total Sales (LYD)", "Commission (LYD)", "Payout (LYD)", "Status"];
  const rows = payouts.map((p) => [
    escape(p.merchantName),
    new Date(p.periodStart).toISOString().slice(0, 10),
    new Date(p.periodEnd).toISOString().slice(0, 10),
    String(p.orderCount),
    (p.totalSalesCents / 100).toFixed(2),
    (p.commissionCents / 100).toFixed(2),
    (p.amountCents / 100).toFixed(2),
    p.status,
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default function AdminPayoutsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calcMessage, setCalcMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!token) return;
    setLoading(true);
    api
      .adminPayouts(token, statusFilter || undefined)
      .then(({ stats, payouts }) => {
        setStats(stats);
        setPayouts(payouts);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [token, statusFilter]);

  async function handleCalculate() {
    if (!token) return;
    setError(null);
    setCalcMessage(null);
    setCalculating(true);
    try {
      const result = await api.calculatePayouts(token, {
        periodStart: periodStart ? new Date(periodStart).toISOString() : undefined,
        periodEnd: periodEnd ? new Date(periodEnd).toISOString() : undefined,
      });
      setCalcMessage(
        result.merchantsCount === 0
          ? "لا توجد طلبات مؤهلة للدفع في هذه الفترة"
          : `✓ تم احتساب ${result.merchantsCount} دفعة لـ ${result.ordersCount} طلب — إجمالي المستحقات ${formatLYD(result.totalPayoutCents)}`
      );
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر احتساب الدفعات");
    } finally {
      setCalculating(false);
    }
  }

  async function handleMarkPaid(payout: Payout) {
    if (!token) return;
    const note = window.prompt("ملاحظة (اختياري):") || undefined;
    try {
      await api.markPayoutPaid(token, payout.id, note);
      refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "تعذّر تحديث الدفعة");
    }
  }

  function handleDownloadCsv() {
    const csv = toCsv(payouts);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">مستحقات التجار</h1>

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="إجمالي المبيعات" value={formatLYD(stats.totalSalesCents)} />
          <StatTile label="عمولة رفقة" value={formatLYD(stats.totalCommissionCents)} />
          <StatTile label="مستحقات معلّقة" value={formatLYD(stats.pendingPayoutCents)} />
          <StatTile label="عدد الدفعات المعلّقة" value={String(stats.pendingPayoutCount)} />
        </div>
      )}

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">احتساب دفعات جديدة</h2>
        <p className="mb-4 text-sm text-gray-600">
          يشمل الاحتساب فقط الطلبات المُسلَّمة والمدفوعة عبر المحفظة الإلكترونية (DPay) — طلبات الدفع عند الاستلام لا
          تمر عبر حساب رفقة، فلا يوجد ما يُدفع للتاجر بخصوصها عبر هذا النظام. اتركا الحقول فارغة لاحتساب آخر 7 أيام.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">من تاريخ</span>
            <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">إلى تاريخ</span>
            <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="rounded-lg border px-3 py-2" />
          </label>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="rounded-lg bg-harbor px-6 py-2 font-bold text-white transition hover:bg-harbor-deep disabled:opacity-50"
          >
            {calculating ? "جارٍ الاحتساب..." : "احتساب الدفعات"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {calcMessage && <p className="text-sm text-gray-700">{calcMessage}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {["", "pending", "processing", "completed"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  statusFilter === s ? "bg-harbor text-white" : "border border-gray-200 text-gray-700"
                }`}
              >
                {s ? STATUS_LABELS[s] : "الكل"}
              </button>
            ))}
          </div>
          <button
            onClick={handleDownloadCsv}
            disabled={payouts.length === 0}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            تنزيل CSV
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">جاري التحميل...</p>
        ) : payouts.length === 0 ? (
          <p className="text-gray-600">لا توجد دفعات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">التاجر</th>
                  <th className="px-4 py-3 text-right font-bold">الفترة</th>
                  <th className="px-4 py-3 text-right font-bold">الطلبات</th>
                  <th className="px-4 py-3 text-right font-bold">إجمالي المبيعات</th>
                  <th className="px-4 py-3 text-right font-bold">العمولة</th>
                  <th className="px-4 py-3 text-right font-bold">المستحق</th>
                  <th className="px-4 py-3 text-right font-bold">الحالة</th>
                  <th className="px-4 py-3 text-right font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold">{p.merchantName}</td>
                    <td className="px-4 py-3 text-gray-600">
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
                    <td className="px-4 py-3">
                      {p.status !== "completed" && (
                        <button
                          onClick={() => void handleMarkPaid(p)}
                          className="rounded bg-green-600 px-3 py-1 text-xs font-bold text-white hover:bg-green-700"
                        >
                          تحديد كمدفوع
                        </button>
                      )}
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-harbor">{value}</p>
    </div>
  );
}
