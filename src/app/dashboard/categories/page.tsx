"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type Category } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

// null = modal closed, {} = adding a new category, a real Category = editing one.
type EditTarget = Category | Record<string, never> | null;

export default function DashboardCategoriesPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listCategories(token, store.id).then(setCategories);
  }

  useEffect(refresh, [token, store]);

  if (!store) return null;

  function openAdd() {
    setName("");
    setImageUrl(null);
    setEditTarget({});
  }

  function openEdit(category: Category) {
    setName(category.name);
    setImageUrl(category.imageUrl);
    setEditTarget(category);
  }

  async function handleImageUpload(file: File) {
    if (!token) return;
    setUploadingImage(true);
    try {
      const { url } = await api.uploadImage(token, file);
      setImageUrl(url);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر رفع الصورة", "error");
    } finally {
      setUploadingImage(false);
    }
  }

  function closeModal() {
    if (saving) return;
    setEditTarget(null);
  }

  async function handleSave() {
    if (!token || !store || !editTarget || !name.trim()) return;
    setSaving(true);
    try {
      if ("id" in editTarget) {
        await api.updateCategory(token, editTarget.id, { name: name.trim(), imageUrl });
      } else {
        await api.createCategory(token, { storeId: store.id, name: name.trim(), imageUrl });
      }
      setEditTarget(null);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ التصنيف", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف تصنيف "${category.name}"؟ ستبقى منتجاته بلا تصنيف.`)) return;
    setDeletingId(category.id);
    try {
      await api.deleteCategory(token, category.id);
      setCategories((prev) => prev?.filter((c) => c.id !== category.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف التصنيف", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Category>[] = [
    { key: "name", header: "الاسم", accessor: (c) => c.name, sortable: true, render: (c) => <span className="font-bold text-harbor">{c.name}</span> },
    {
      key: "slug",
      header: "الرابط",
      render: (c) => (
        <span className="font-mono text-xs text-rope" dir="ltr">
          ?category={c.slug}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="flex items-center gap-3">
          <button onClick={() => openEdit(c)} className="text-xs font-bold text-harbor hover:underline">
            تعديل
          </button>
          <button
            onClick={() => handleDelete(c)}
            disabled={deletingId === c.id}
            className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
          >
            {deletingId === c.id ? "جارٍ الحذف..." : "حذف"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-extrabold text-harbor">التصنيفات</h1>
        <Button onClick={openAdd}>+ تصنيف جديد</Button>
      </div>

      {categories === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={3} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={categories}
          rowKey={(c) => c.id}
          searchPlaceholder="ابحث عن تصنيف..."
          searchText={(c) => c.name}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد تصنيفات بعد" description="أضف تصنيفات لتنظيم منتجاتك وتسهيل تصفحها على عملائك." />}
        />
      )}

      <Modal
        open={editTarget !== null}
        onClose={closeModal}
        title={editTarget && "id" in editTarget ? "تعديل التصنيف" : "تصنيف جديد"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!name.trim()}>
              حفظ
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">اسم التصنيف</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: أحذية" />
        </label>

        <div className="mt-4">
          <span className="block text-sm font-bold text-harbor mb-1.5">صورة التصنيف (اختياري)</span>
          <p className="text-xs text-rope mb-2">تظهر في قسم &quot;تسوّق حسب التصنيف&quot; على واجهة المتجر، إن فعّلته.</p>
          <div className="flex items-center gap-4">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover border border-harbor/10" />
            )}
            <label className="flex-1">
              <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
                {uploadingImage ? "جارٍ الرفع..." : imageUrl ? "تغيير الصورة" : "اختر صورة"}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImageUpload(file);
                }}
              />
            </label>
            {imageUrl && (
              <button type="button" onClick={() => setImageUrl(null)} className="text-xs font-bold text-signal hover:underline shrink-0">
                إزالة
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
