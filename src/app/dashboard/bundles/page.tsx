"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Bundle, type Product } from "@/lib/api";
import ProductGalleryUpload from "@/components/products/ProductGalleryUpload";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

// null = modal closed, {} = adding a new bundle, a real Bundle = editing one.
type EditTarget = Bundle | Record<string, never> | null;
type DraftItem = { productId: string; quantity: number };

export default function DashboardBundlesPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listBundles(token, store.id).then(setBundles);
  }

  useEffect(refresh, [token, store]);
  useEffect(() => {
    if (!token || !store) return;
    api.productsByStore(token, store.id).then(setProducts);
  }, [token, store]);

  if (!store) return null;

  function openAdd() {
    setName("");
    setPrice("");
    setImageUrl(null);
    setItems([]);
    setEditTarget({});
  }

  function openEdit(bundle: Bundle) {
    setName(bundle.name);
    setPrice(String(bundle.priceCents / 100));
    setImageUrl(bundle.imageUrl);
    setItems(bundle.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
    setEditTarget(bundle);
  }

  function closeModal() {
    if (saving) return;
    setEditTarget(null);
  }

  function toggleProduct(productId: string) {
    setItems((prev) =>
      prev.some((i) => i.productId === productId) ? prev.filter((i) => i.productId !== productId) : [...prev, { productId, quantity: 1 }]
    );
  }

  function setItemQuantity(productId: string, quantity: number) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i)));
  }

  async function handleSave() {
    if (!token || !store || !editTarget || !name.trim() || !price || items.length === 0) return;
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price) * 100);
      if ("id" in editTarget) {
        await api.updateBundle(token, editTarget.id, { name: name.trim(), priceCents, imageUrl, items });
      } else {
        await api.createBundle(token, { storeId: store.id, name: name.trim(), priceCents, imageUrl, items });
      }
      setEditTarget(null);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ الباقة", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bundle: Bundle) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف باقة "${bundle.name}"؟`)) return;
    setDeletingId(bundle.id);
    try {
      await api.deleteBundle(token, bundle.id);
      setBundles((prev) => prev?.filter((b) => b.id !== bundle.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف الباقة", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Bundle>[] = [
    { key: "name", header: "الاسم", accessor: (b) => b.name, sortable: true, render: (b) => <span className="font-bold text-harbor">{b.name}</span> },
    { key: "price", header: "السعر", accessor: (b) => b.priceCents, sortable: true, render: (b) => formatLYD(b.priceCents) },
    { key: "items", header: "عدد المنتجات", render: (b) => b.items.length },
    {
      key: "actions",
      header: "",
      render: (b) => (
        <div className="flex items-center gap-3">
          <button onClick={() => openEdit(b)} className="text-xs font-bold text-harbor hover:underline">
            تعديل
          </button>
          <button
            onClick={() => handleDelete(b)}
            disabled={deletingId === b.id}
            className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
          >
            {deletingId === b.id ? "جارٍ الحذف..." : "حذف"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-extrabold text-harbor">الباقات</h1>
        <Button onClick={openAdd}>+ باقة جديدة</Button>
      </div>

      {bundles === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={4} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={bundles}
          rowKey={(b) => b.id}
          searchPlaceholder="ابحث عن باقة..."
          searchText={(b) => b.name}
          pageSize={15}
          emptyState={<EmptyState title="لا توجد باقات بعد" description="أنشئ باقة من منتجاتك بسعر ثابت مخفّض لتشجيع الشراء بكمية أكبر." />}
        />
      )}

      <Modal
        open={editTarget !== null}
        onClose={closeModal}
        title={editTarget && "id" in editTarget ? "تعديل الباقة" : "باقة جديدة"}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!name.trim() || !price || items.length === 0}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">اسم الباقة</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: باقة العيد" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">السعر الإجمالي للباقة (د.ل)</span>
            <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="input" dir="ltr" />
          </label>
          <div>
            <span className="block text-sm font-bold text-harbor mb-1.5">صورة الباقة (اختياري)</span>
            <ProductGalleryUpload images={imageUrl ? [imageUrl] : []} onChange={(imgs) => setImageUrl(imgs[0] ?? null)} />
          </div>
          <div>
            <span className="block text-sm font-bold text-harbor mb-2">منتجات الباقة</span>
            {products.length === 0 ? (
              <p className="text-xs text-rope">أضف منتجات لمتجرك أولًا.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {products.map((p) => {
                  const item = items.find((i) => i.productId === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-harbor/10 px-3 py-2">
                      <label className="flex items-center gap-2 min-w-0 flex-1">
                        <input type="checkbox" checked={Boolean(item)} onChange={() => toggleProduct(p.id)} className="h-4 w-4 accent-brass" />
                        <span className="text-sm text-harbor truncate">{p.name}</span>
                      </label>
                      {item && (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setItemQuantity(p.id, Number(e.target.value) || 1)}
                          className="input w-16 text-center shrink-0"
                          dir="ltr"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
