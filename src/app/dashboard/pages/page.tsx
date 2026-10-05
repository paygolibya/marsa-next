"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type Page } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

type EditTarget = Page | Record<string, never> | null;

export default function DashboardPagesPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [pages, setPages] = useState<Page[] | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listPages(token, store.id).then(setPages);
  }

  useEffect(refresh, [token, store]);

  if (!store) return null;

  function openAdd() {
    setTitle("");
    setContent("");
    setEditTarget({});
  }

  function openEdit(page: Page) {
    setTitle(page.title);
    setContent(page.content);
    setEditTarget(page);
  }

  function closeModal() {
    if (saving) return;
    setEditTarget(null);
  }

  async function handleSave() {
    if (!token || !store || !editTarget || !title.trim()) return;
    setSaving(true);
    try {
      if ("id" in editTarget) {
        await api.updatePage(token, editTarget.id, { title: title.trim(), content });
      } else {
        await api.createPage(token, { storeId: store.id, title: title.trim(), content });
      }
      setEditTarget(null);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ الصفحة", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(page: Page) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف صفحة "${page.title}"؟`)) return;
    setDeletingId(page.id);
    try {
      await api.deletePage(token, page.id);
      setPages((prev) => prev?.filter((p) => p.id !== page.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف الصفحة", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Page>[] = [
    { key: "title", header: "العنوان", accessor: (p) => p.title, sortable: true, render: (p) => <span className="font-bold text-harbor">{p.title}</span> },
    {
      key: "slug",
      header: "الرابط",
      render: (p) => (
        <span className="font-mono text-xs text-rope" dir="ltr">
          /page/{p.slug}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex items-center gap-3">
          <button onClick={() => openEdit(p)} className="text-xs font-bold text-harbor hover:underline">
            تعديل
          </button>
          <button
            onClick={() => handleDelete(p)}
            disabled={deletingId === p.id}
            className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
          >
            {deletingId === p.id ? "جارٍ الحذف..." : "حذف"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-extrabold text-harbor">الصفحات</h1>
        <Button onClick={openAdd}>+ صفحة جديدة</Button>
      </div>

      {pages === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={3} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={pages}
          rowKey={(p) => p.id}
          searchPlaceholder="ابحث عن صفحة..."
          searchText={(p) => p.title}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد صفحات بعد" description="أضف صفحات ثابتة مثل سياسة الاستبدال أو عن المتجر." />}
        />
      )}

      <Modal
        open={editTarget !== null}
        onClose={closeModal}
        title={editTarget && "id" in editTarget ? "تعديل الصفحة" : "صفحة جديدة"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!title.trim()}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">عنوان الصفحة</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="مثال: سياسة الاستبدال" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">المحتوى</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input" rows={8} placeholder="نص الصفحة..." />
          </label>
        </div>
      </Modal>
    </div>
  );
}
