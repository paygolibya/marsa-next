"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type Product, type Upsell } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

export default function DashboardUpsellsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [upsells, setUpsells] = useState<Upsell[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [triggerProductId, setTriggerProductId] = useState("");
  const [offeredProductId, setOfferedProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listUpsells(token, store.id).then(setUpsells);
  }

  useEffect(refresh, [token, store]);
  useEffect(() => {
    if (!token || !store) return;
    api.productsByStore(token, store.id).then(setProducts);
  }, [token, store]);

  if (!store) return null;

  function openAdd() {
    setTriggerProductId("");
    setOfferedProductId("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token || !store || !triggerProductId || !offeredProductId) return;
    setSaving(true);
    try {
      await api.createUpsell(token, { storeId: store.id, triggerProductId, offeredProductId });
      setModalOpen(false);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ الاقتراح", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(upsell: Upsell) {
    if (!token || togglingId) return;
    setTogglingId(upsell.id);
    try {
      const updated = await api.updateUpsell(token, upsell.id, { active: !upsell.active });
      setUpsells((prev) => prev?.map((u) => (u.id === upsell.id ? { ...u, active: updated.active } : u)) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تحديث الاقتراح", "error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(upsell: Upsell) {
    if (!token || deletingId) return;
    if (!window.confirm("حذف هذا الاقتراح؟")) return;
    setDeletingId(upsell.id);
    try {
      await api.deleteUpsell(token, upsell.id);
      setUpsells((prev) => prev?.filter((u) => u.id !== upsell.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف الاقتراح", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Upsell>[] = [
    { key: "trigger", header: "عند شراء", accessor: (u) => u.triggerProduct.name, render: (u) => <span className="font-bold text-harbor">{u.triggerProduct.name}</span> },
    { key: "offered", header: "يُقترح", accessor: (u) => u.offeredProduct.name, render: (u) => u.offeredProduct.name },
    {
      key: "active",
      header: "مفعّل",
      render: (u) => (
        <button
          onClick={() => handleToggle(u)}
          disabled={togglingId === u.id}
          className={`h-6 w-11 rounded-full transition-colors relative disabled:opacity-50 ${u.active ? "bg-brass" : "bg-harbor/20"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${u.active ? "translate-x-0.5" : "translate-x-5"}`} />
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <button
          onClick={() => handleDelete(u)}
          disabled={deletingId === u.id}
          className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
        >
          {deletingId === u.id ? "جارٍ الحذف..." : "حذف"}
        </button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-extrabold text-harbor">الاقتراحات الإضافية</h1>
        <Button onClick={openAdd}>+ اقتراح جديد</Button>
      </div>
      <p className="text-sm text-rope mb-6">عند إضافة منتج "عند الشراء" للسلة، يظهر المنتج "المقترح" كبطاقة صغيرة في السلة — دون إضافته تلقائيًا.</p>

      {upsells === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={4} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={upsells}
          rowKey={(u) => u.id}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد اقتراحات بعد" description="اقترح منتجات مكمّلة لعملائك عند إضافة منتج معيّن للسلة." />}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="اقتراح جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!triggerProductId || !offeredProductId || triggerProductId === offeredProductId}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">عند شراء هذا المنتج</span>
            <select value={triggerProductId} onChange={(e) => setTriggerProductId(e.target.value)} className="input">
              <option value="">اختر منتجًا</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">اقترح هذا المنتج</span>
            <select value={offeredProductId} onChange={(e) => setOfferedProductId(e.target.value)} className="input">
              <option value="">اختر منتجًا</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {triggerProductId && offeredProductId && triggerProductId === offeredProductId && (
            <p className="text-signal text-sm">لا يمكن اقتراح المنتج نفسه عند شرائه</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
