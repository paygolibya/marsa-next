"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type BugReport } from "@/lib/api";
import { Badge, type BadgeTone, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow } from "@/components/ui";

const STATUS_LABELS: Record<BugReport["status"], string> = {
  open: "مفتوحة",
  investigating: "قيد المراجعة",
  fixed: "تم الإصلاح",
  wont_fix: "لن يتم إصلاحها",
};
const STATUS_TONES: Record<BugReport["status"], BadgeTone> = {
  open: "danger",
  investigating: "warning",
  fixed: "success",
  wont_fix: "neutral",
};
const STATUS_OPTIONS: BugReport["status"][] = ["open", "investigating", "fixed", "wont_fix"];

export default function AdminEscalationsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<BugReport[] | null>(null);
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!token) return;
    api.adminBugReports(token).then((data) => setReports(data.reports));
  }

  useEffect(refresh, [token]);

  async function handleStatusChange(status: BugReport["status"]) {
    if (!token || !selected) return;
    setUpdating(true);
    setError(null);
    try {
      const { report } = await api.adminUpdateBugReportStatus(token, selected.id, status);
      setSelected(report);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحديث الحالة");
    } finally {
      setUpdating(false);
    }
  }

  const columns: DataTableColumn<BugReport>[] = [
    { key: "merchant", header: "التاجر", accessor: (r) => r.merchant?.name ?? r.merchantId, sortable: true },
    {
      key: "summary",
      header: "الملخص",
      accessor: (r) => r.summary,
      sortable: true,
      render: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="font-bold text-harbor hover:underline text-right">
          {r.summary}
        </button>
      ),
    },
    { key: "status", header: "الحالة", render: (r) => <Badge tone={STATUS_TONES[r.status]}>{STATUS_LABELS[r.status]}</Badge> },
    { key: "createdAt", header: "التاريخ", accessor: (r) => r.createdAt, sortable: true, render: (r) => new Date(r.createdAt).toLocaleString("ar-LY") },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-harbor">المشاكل المُصعّدة من الدعم الفني</h1>

      {reports === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={4} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={reports}
          rowKey={(r) => r.id}
          searchPlaceholder="ابحث بالتاجر أو الملخص..."
          searchText={(r) => `${r.merchant?.name ?? ""} ${r.summary}`}
          emptyState={<EmptyState title="لا توجد مشاكل مُصعّدة حاليًا" />}
        />
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.summary}>
        {selected && (
          <div className="space-y-4">
            <div className="text-sm text-rope">
              <p>
                <span className="font-bold text-harbor">التاجر:</span> {selected.merchant?.name} ({selected.merchant?.phone})
              </p>
              <p>
                <span className="font-bold text-harbor">التاريخ:</span> {new Date(selected.createdAt).toLocaleString("ar-LY")}
              </p>
            </div>

            <div>
              <p className="font-bold text-harbor text-sm mb-1">التفاصيل</p>
              <p className="text-sm text-harbor/90 whitespace-pre-wrap rounded-xl bg-harbor/5 p-3">{selected.details}</p>
            </div>

            {selected.conversation && selected.conversation.messages.length > 0 && (
              <div>
                <p className="font-bold text-harbor text-sm mb-1">المحادثة</p>
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl border border-harbor/10 p-3">
                  {selected.conversation.messages.map((m, i) => (
                    <p key={i} className="text-xs">
                      <span className="font-bold text-harbor">{m.role === "user" ? "التاجر" : "المساعد"}: </span>
                      <span className="text-harbor/80">{m.content}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-bold text-harbor text-sm mb-2">الحالة</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={updating || selected.status === s}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      selected.status === s ? "bg-harbor text-canvas" : "border border-harbor/20 text-harbor hover:bg-harbor/5"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {error && <p className="text-signal text-xs mt-2">{error}</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
