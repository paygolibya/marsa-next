"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, formatLYD } from "@/lib/api";
import type { Payout, PlatformStats } from "@/types/payment";

const STATUS_LABELS: Record<string, string> = {
  ready_for_transfer: "جاهزة للتحويل",
  transferred: "تم التحويل",
};

const STATUS_CLASSES: Record<string, string> = {
  ready_for_transfer: "bg-yellow-100 text-yellow-800",
  transferred: "bg-green-100 text-green-800",
};

function toCsv(payouts: Payout[]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Merchant", "Period Start", "Period End", "Orders", "Total Sales (LYD)", "Commission (LYD)", "Payout (LYD)", "Status", "Transfer Reference"];
  const rows = payouts.map((p) => [
    escape(p.merchantName),
    new Date(p.periodStart).toISOString().slice(0, 10),
    new Date(p.periodEnd).toISOString().slice(0, 10),
    String(p.orderCount),
    (p.totalSalesCents / 100).toFixed(2),
    (p.commissionCents / 100).toFixed(2),
    (p.amountCents / 100).toFixed(2),
    p.status,
    escape(p.transferReference ?? ""),
  ]);
  return [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export default function AdminPayoutsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر تحميل الدفعات"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [token, statusFilter]);

  async function handleTransfer(payout: Payout) {
    if (!token) return;
    const transferReference = window.prompt("رقم/مرجع التحويل البنكي (اختياري):") || undefined;
    try {
      await api.transferPayout(token, payout.id, { transferReference });
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
      <h1 className="mb-2 text-4xl font-bold text-harbor">مستحقات التجار</h1>
      <p className="mb-8 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        ⚡ يتم احتساب المستحقات تلقائيًا فور تسليم الطلب، وتُجمَّع أسبوعيًا كل يوم جمعة — لا حاجة لأي إجراء يدوي للحساب.
        الإجراء اليدوي الوحيد هو الضغط على &quot;تحويل&quot; بعد إرسال المبلغ فعليًا للتاجر.
      </p>

      {stats && (
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="إجمالي المبيعات" value={formatLYD(stats.totalSalesCents)} />
          <StatTile label="عمولة رفقة" value={formatLYD(stats.totalCommissionCents)} />
          <StatTile label="مستحقات معلّقة" value={formatLYD(stats.pendingPayoutCents)} />
          <StatTile label="عدد الدفعات المعلّقة" value={String(stats.pendingPayoutCount)} />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {["", "ready_for_transfer", "transferred"].map((s) => (
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

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-gray-600">جاري التحميل...</p>
        ) : payouts.length === 0 ? (
          <p className="text-gray-600">لا توجد دفعات بعد — ستظهر هنا تلقائيًا بعد أول عملية تجميع أسبوعية.</p>
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
                      {p.status !== "transferred" ? (
                        <button
                          onClick={() => void handleTransfer(p)}
                          className="rounded bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700"
                        >
                          تحويل
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">
                          {p.transferredAt ? new Date(p.transferredAt).toLocaleDateString("ar-LY") : "—"}
                        </span>
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
