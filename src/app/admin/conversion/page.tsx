"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, type AdminConversionRow } from "@/lib/api";
import { STAGE_LABELS, type ConversionStage } from "@/lib/conversion";
import { Badge, type BadgeTone, DataTable, type DataTableColumn, SkeletonRow } from "@/components/ui";

// /admin/conversion — trial → paid follow-up board. Every merchant's
// funnel stage and days left (most urgent first), with a one-click
// WhatsApp button that opens a chat pre-filled with the right next message
// for their stage (and their payment link near the trial end).

const STAGE_ORDER: ConversionStage[] = ["paid", "selling", "no_orders", "booking_no_hours", "no_products", "no_store", "not_verified"];

const STAGE_TONES: Record<ConversionStage, BadgeTone> = {
  paid: "success",
  selling: "success",
  no_orders: "info",
  booking_no_hours: "warning",
  no_products: "warning",
  no_store: "danger",
  not_verified: "neutral",
};

function daysLabel(d: number | null) {
  if (d === null) return "—";
  if (d < 0) return `انتهت منذ ${-d} يوم`;
  if (d === 0) return "تنتهي اليوم";
  return `${d} يوم`;
}

export default function AdminConversionPage() {
  const { token } = useAuth();
  const [data, setData] = useState<{ total: number; byStage: Record<string, number>; rows: AdminConversionRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ConversionStage | "all">("all");

  useEffect(() => {
    if (!token) return;
    api.adminConversion(token).then(setData).catch((e) => setError(e instanceof Error ? e.message : "تعذّر التحميل"));
  }, [token]);

  const rows = useMemo(() => (data ? data.rows.filter((r) => stage === "all" || r.stage === stage) : []), [data, stage]);

  const columns: DataTableColumn<AdminConversionRow>[] = [
    { key: "name", header: "التاجر", accessor: (r) => r.name, sortable: true, render: (r) => (
      <div>
        <p className="font-bold text-harbor">{r.name}</p>
        <p className="text-xs text-rope" dir="ltr">{r.phone}</p>
      </div>
    ) },
    { key: "stage", header: "المرحلة", accessor: (r) => STAGE_ORDER.indexOf(r.stage), sortable: true, render: (r) => <Badge tone={STAGE_TONES[r.stage]} dot>{STAGE_LABELS[r.stage]}</Badge> },
    { key: "store", header: "المتجر", render: (r) => (r.store ? <span className="text-sm">{r.store}</span> : "—") },
    { key: "products", header: "منتجات", accessor: (r) => r.products, sortable: true, align: "center" },
    { key: "orders", header: "طلبات", accessor: (r) => r.orders, sortable: true, align: "center" },
    { key: "daysLeft", header: "تنتهي الفترة", accessor: (r) => r.daysLeft ?? 9999, sortable: true, render: (r) => (
      <span className={`whitespace-nowrap text-sm font-bold ${r.daysLeft !== null && r.daysLeft <= 10 ? "text-signal" : "text-harbor"}`}>{daysLabel(r.daysLeft)}</span>
    ) },
    { key: "wa", header: "", render: (r) => (
      <a
        href={r.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[36px] items-center rounded-full bg-green-600 px-4 text-xs font-bold text-white hover:bg-green-700 transition-colors whitespace-nowrap"
      >
        واتساب
      </a>
    ) },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-1">متابعة الاشتراكات</h1>
      <p className="text-rope mb-6">من الفترة التجريبية إلى الاشتراك المدفوع — الأقرب انتهاءً أولًا. زر واتساب يفتح رسالة جاهزة حسب مرحلة كل تاجر.</p>

      {error && <p className="mb-4 rounded-xl bg-signal/10 p-3 text-signal">{error}</p>}

      {data && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setStage("all")} className={`rounded-full px-4 py-2 text-sm font-bold ${stage === "all" ? "bg-harbor text-white" : "bg-white text-harbor border border-harbor/15"}`}>
            الكل ({data.total})
          </button>
          {STAGE_ORDER.filter((s) => data.byStage[s]).map((s) => (
            <button key={s} onClick={() => setStage(s)} className={`rounded-full px-4 py-2 text-sm font-bold ${stage === s ? "bg-harbor text-white" : "bg-white text-harbor border border-harbor/15"}`}>
              {STAGE_LABELS[s]} ({data.byStage[s]})
            </button>
          ))}
        </div>
      )}

      {!data && !error ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} searchText={(r) => `${r.name} ${r.phone} ${r.store ?? ""}`} searchPlaceholder="ابحث بالاسم أو الرقم أو المتجر..." pageSize={25} />
      )}
    </div>
  );
}
