"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type Redirect } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

export default function DashboardRedirectsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [redirects, setRedirects] = useState<Redirect[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listRedirects(token, store.id).then(setRedirects);
  }

  useEffect(refresh, [token, store]);

  if (!store) return null;

  function openAdd() {
    setFromPath("");
    setToPath("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token || !store || !fromPath.trim() || !toPath.trim()) return;
    setSaving(true);
    try {
      await api.createRedirect(token, { storeId: store.id, fromPath: fromPath.trim(), toPath: toPath.trim() });
      setModalOpen(false);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ إعادة التوجيه", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(redirect: Redirect) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف إعادة التوجيه من "${redirect.fromPath}"؟`)) return;
    setDeletingId(redirect.id);
    try {
      await api.deleteRedirect(token, redirect.id);
      setRedirects((prev) => prev?.filter((r) => r.id !== redirect.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف إعادة التوجيه", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Redirect>[] = [
    {
      key: "fromPath",
      header: "من",
      accessor: (r) => r.fromPath,
      render: (r) => (
        <span className="font-mono text-xs text-harbor" dir="ltr">
          {r.fromPath}
        </span>
      ),
    },
    {
      key: "toPath",
      header: "إلى",
      accessor: (r) => r.toPath,
      render: (r) => (
        <span className="font-mono text-xs text-rope" dir="ltr">
          {r.toPath}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => handleDelete(r)}
          disabled={deletingId === r.id}
          className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
        >
          {deletingId === r.id ? "جارٍ الحذف..." : "حذف"}
        </button>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-extrabold text-harbor">إعادة التوجيه</h1>
        <Button onClick={openAdd}>+ إعادة توجيه جديدة</Button>
      </div>
      <p className="text-sm text-rope mb-6">وجّه زوار رابط قديم (مثل منتج أعدت تسميته) إلى رابط جديد تلقائيًا.</p>

      {redirects === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={3} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={redirects}
          rowKey={(r) => r.id}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد إعادة توجيه بعد" description="أضف إعادة توجيه عند تغيير رابط صفحة أو منتج." />}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="إعادة توجيه جديدة"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!fromPath.trim() || !toPath.trim()}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">المسار القديم</span>
            <input autoFocus value={fromPath} onChange={(e) => setFromPath(e.target.value)} className="input" dir="ltr" placeholder="/old-product-url" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">المسار الجديد</span>
            <input value={toPath} onChange={(e) => setToPath(e.target.value)} className="input" dir="ltr" placeholder="/product/new-product-id" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
