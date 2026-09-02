"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { CronLog } from "@/types/payment";

const JOB_LABELS: Record<string, string> = {
  "process-deliveries": "احتساب الطلبات المُسلَّمة (يومي 8:00 ص)",
  "weekly-payouts": "تجميع الدفعات الأسبوعية (جمعة 9:00 ص)",
  "expire-subscriptions": "إنهاء الاشتراكات المنتهية (يومي 3:00 ص)",
};

export default function CronLogsPage() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<CronLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .adminCronLogs(token)
      .then(({ logs }) => setLogs(logs))
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر تحميل السجل"));
  }, [token]);

  return (
    <div>
      <h1 className="mb-2 text-4xl font-bold text-harbor">سجل المهام التلقائية</h1>
      <p className="mb-8 text-sm text-gray-600">
        تتبّع تنفيذ مهام الاحتساب التلقائي — الاحتساب اليومي للطلبات المُسلَّمة، والتجميع الأسبوعي للدفعات. تُعاد
        المحاولة تلقائيًا حتى 3 مرات عند فشل أي مهمة.
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {logs === null ? (
          <p className="text-gray-600">جاري التحميل...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-600">لم تُنفَّذ أي مهمة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">المهمة</th>
                  <th className="px-4 py-3 text-right font-bold">الحالة</th>
                  <th className="px-4 py-3 text-right font-bold">طلبات معالَجة</th>
                  <th className="px-4 py-3 text-right font-bold">دفعات منشأة</th>
                  <th className="px-4 py-3 text-right font-bold">المدة</th>
                  <th className="px-4 py-3 text-right font-bold">الوقت</th>
                  <th className="px-4 py-3 text-right font-bold">خطأ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold">{JOB_LABELS[log.jobName] ?? log.jobName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          log.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status === "success" ? "نجاح" : "فشل"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{log.ordersProcessed}</td>
                    <td className="px-4 py-3">{log.payoutsCreated}</td>
                    <td className="px-4 py-3 text-gray-600">{log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)} ث` : "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(log.executedAt).toLocaleString("ar-LY")}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-xs text-red-600" title={log.errorMessage ?? ""}>
                      {log.errorMessage ?? "—"}
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
