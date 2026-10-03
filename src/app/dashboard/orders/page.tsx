"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Order } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

const statusLabels: Record<Order["status"], string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغى",
  refunded: "مسترد",
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
  const { show } = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<Order["status"] | "all">("all");
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !store) return;
    setOrders(null);
    api.ordersByStore(token, store.id).then(setOrders);
  }, [token, store]);

  if (!store) return null;

  const visible = orders === null ? [] : filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function closeRefundModal() {
    if (refunding) return;
    setRefundTarget(null);
    setRefundReason("");
  }

  async function handleConfirmRefund() {
    if (!token || !refundTarget) return;
    setRefunding(true);
    try {
      const { note } = await api.refundOrder(token, refundTarget.id, refundReason.trim() || undefined);
      setOrders((prev) => prev?.map((o) => (o.id === refundTarget.id ? { ...o, status: "refunded" } : o)) ?? prev);
      show(note ? `تم الاسترداد — ${note}` : "تم استرداد الطلب", note ? "info" : "success");
      setRefundTarget(null);
      setRefundReason("");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر استرداد الطلب", "error");
    } finally {
      setRefunding(false);
    }
  }

  async function handleConfirmOrder(order: Order) {
    if (!token || confirmingId) return;
    setConfirmingId(order.id);
    try {
      await api.confirmOrder(token, order.id);
      setOrders((prev) => prev?.map((o) => (o.id === order.id ? { ...o, status: "confirmed" } : o)) ?? prev);
      show("تم تأكيد الطلب", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تأكيد الطلب", "error");
    } finally {
      setConfirmingId(null);
    }
  }

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
    ...(store.type === "rental"
      ? [
          {
            key: "rentalPeriod",
            header: "فترة الاستئجار",
            render: (o: Order) =>
              o.scheduledStartAt && o.scheduledEndAt
                ? `${new Date(o.scheduledStartAt).toLocaleDateString("ar-LY")} → ${new Date(o.scheduledEndAt).toLocaleDateString("ar-LY")}`
                : "—",
          },
        ]
      : []),
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
    {
      key: "actions",
      header: "",
      render: (o) => (
        <div className="flex items-center gap-3">
          {o.status === "pending" && (
            <button
              onClick={() => handleConfirmOrder(o)}
              disabled={confirmingId === o.id}
              className="text-xs font-bold text-harbor hover:underline disabled:opacity-50"
            >
              {confirmingId === o.id ? "جارٍ التأكيد..." : "تأكيد الطلب"}
            </button>
          )}
          {o.status !== "refunded" && (
            <button onClick={() => setRefundTarget(o)} className="text-xs font-bold text-signal hover:underline">
              استرداد
            </button>
          )}
        </div>
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

      <Modal
        open={refundTarget !== null}
        onClose={closeRefundModal}
        title="استرداد الطلب"
        footer={
          <>
            <Button variant="secondary" onClick={closeRefundModal} disabled={refunding}>
              إلغاء
            </Button>
            <Button onClick={handleConfirmRefund} loading={refunding} loadingText="جارٍ الاسترداد...">
              تأكيد الاسترداد
            </Button>
          </>
        }
      >
        {refundTarget && (
          <div className="space-y-4">
            <p className="text-rope text-sm">
              سيتم تعليم طلب <span className="font-bold text-harbor">{refundTarget.buyerName}</span> بقيمة{" "}
              <span className="font-bold text-harbor">{formatLYD(refundTarget.totalCents)}</span> كطلب مسترد.
            </p>
            {refundTarget.paymentMethod === "wallet" && (
              <p className="text-xs text-signal">
                ملاحظة: هذا الطلب مدفوع عبر المحفظة الإلكترونية — لا توجد واجهة استرداد آلي عبر مؤمالات حاليًا، لذا يجب إرجاع المبلغ للعميل
                يدويًا خارج المنصة. هذا الإجراء يسجّل عملية الاسترداد فقط.
              </p>
            )}
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">سبب الاسترداد (اختياري)</span>
              <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={2} className="input" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
