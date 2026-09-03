"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Product } from "@/lib/api";
import ProductImageUpload from "@/components/products/ProductImageUpload";

export default function DashboardProductsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [trackInventory, setTrackInventory] = useState(false);
  const [stockQty, setStockQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.productsByStore(token, store.id).then(setProducts);
  }

  useEffect(refresh, [token, store]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setError(null);
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price) * 100);
      const created = await api.createProduct(token, { storeId: store.id, name, priceCents, imageUrl: imageUrl || null });
      if (trackInventory) {
        await api.updateProduct(token, created.id, { trackInventory: true, stockQty: Number(stockQty) || 0 });
      }
      setName("");
      setPrice("");
      setImageUrl("");
      setTrackInventory(false);
      setStockQty("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إضافة المنتج");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    await api.deleteProduct(token, id);
    refresh();
  }

  if (!store) return null;

  return (
    <div className="p-10 grid md:grid-cols-[1fr_1.4fr] gap-10">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">أضف منتجًا</h1>
        <form onSubmit={handleAdd} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">اسم المنتج</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">السعر (د.ل)</span>
            <input
              required
              type="number"
              step="0.01"
              min="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input"
              dir="ltr"
            />
          </label>
          <ProductImageUpload imageUrl={imageUrl || null} onChange={(url) => setImageUrl(url || "")} />

          <div className="flex items-center justify-between rounded-xl border border-harbor/15 bg-white px-4 py-3">
            <span className="font-bold text-harbor text-sm">تتبع المخزون</span>
            <input
              type="checkbox"
              checked={trackInventory}
              onChange={(e) => setTrackInventory(e.target.checked)}
              className="h-5 w-5 accent-brass"
            />
          </div>
          {trackInventory && (
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">الكمية المتوفرة</span>
              <input
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="input"
                dir="ltr"
              />
            </label>
          )}

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {saving ? "جارٍ الإضافة..." : "إضافة المنتج"}
          </button>
        </form>

        <CsvImport token={token} storeId={store.id} onImported={refresh} />
      </div>

      <div>
        <h2 className="font-display text-2xl font-extrabold text-harbor mb-6">منتجاتك</h2>
        {products.length === 0 ? (
          <p className="text-rope">لا توجد منتجات بعد.</p>
        ) : (
          <ul className="space-y-3">
            {products.map((p) =>
              editingId === p.id ? (
                <ProductEditRow
                  key={p.id}
                  product={p}
                  token={token}
                  onDone={() => {
                    setEditingId(null);
                    refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-harbor/10 bg-white/50 px-5 py-3"
                >
                  <div>
                    <p className="font-bold text-harbor flex items-center gap-2">
                      {p.name}
                      {p.trackInventory && p.stockQty <= p.lowStockThreshold && (
                        <span className="stamp h-6 px-2 border-signal text-signal text-[11px] font-bold">مخزون منخفض</span>
                      )}
                    </p>
                    <p className="text-rope text-sm">
                      {formatLYD(p.priceCents)}
                      {p.trackInventory && <span className="mr-2">· الكمية: {p.stockQty}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingId(p.id)} className="text-harbor text-sm font-bold hover:underline">
                      تعديل
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="text-signal text-sm font-bold hover:underline">
                      حذف
                    </button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProductEditRow({
  product,
  token,
  onDone,
  onCancel,
}: {
  product: Product;
  token: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(String(product.priceCents / 100));
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [trackInventory, setTrackInventory] = useState(product.trackInventory);
  const [stockQty, setStockQty] = useState(String(product.stockQty));
  const [lowStockThreshold, setLowStockThreshold] = useState(String(product.lowStockThreshold));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateProduct(token, product.id, {
        name,
        priceCents: Math.round(parseFloat(price) * 100),
        imageUrl: imageUrl || null,
        trackInventory,
        stockQty: Number(stockQty) || 0,
        lowStockThreshold: Number(lowStockThreshold) || 0,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-xl border border-brass/40 bg-white p-4 space-y-3">
      <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="اسم المنتج" />
      <input
        type="number"
        step="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="input"
        dir="ltr"
        placeholder="السعر"
      />
      <ProductImageUpload imageUrl={imageUrl || null} onChange={(url) => setImageUrl(url || "")} />
      <div className="flex items-center justify-between rounded-lg border border-harbor/15 px-3 py-2">
        <span className="text-sm font-bold text-harbor">تتبع المخزون</span>
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => setTrackInventory(e.target.checked)}
          className="h-5 w-5 accent-brass"
        />
      </div>
      {trackInventory && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-rope mb-1">الكمية</span>
            <input type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="input" dir="ltr" />
          </label>
          <label className="block">
            <span className="block text-xs text-rope mb-1">حد التنبيه</span>
            <input
              type="number"
              min="0"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(e.target.value)}
              className="input"
              dir="ltr"
            />
          </label>
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-signal px-4 py-1.5 text-sm font-bold text-canvas hover:bg-signal-dark disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        <button onClick={onCancel} className="rounded-full border border-harbor/20 px-4 py-1.5 text-sm font-bold text-harbor">
          إلغاء
        </button>
      </div>
    </li>
  );
}

function CsvImport({ token, storeId, onImported }: { token: string | null; storeId: string; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ createdCount: number; errors: { row: number; message: string }[] } | null>(null);

  async function handleImport() {
    if (!token || !file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await api.bulkImportProducts(token, storeId, file);
      setResult(res);
      onImported();
    } finally {
      setImporting(false);
      setFile(null);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-harbor/10 bg-white/50 p-4">
      <h3 className="font-bold text-harbor mb-2">استيراد من CSV</h3>
      <p className="text-xs text-rope mb-3" dir="ltr">
        columns: name, price, imageUrl, stock
      </p>
      <div className="flex items-center gap-3">
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        <button
          onClick={handleImport}
          disabled={!file || importing}
          className="rounded-full bg-harbor px-4 py-1.5 text-sm font-bold text-canvas hover:bg-harbor-deep disabled:opacity-60"
        >
          {importing ? "جارٍ الاستيراد..." : "استيراد"}
        </button>
      </div>
      {result && (
        <div className="mt-3 text-sm">
          <p className="text-green-700 font-bold">✓ تم إضافة {result.createdCount} منتج</p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-signal">
              {result.errors.map((e, i) => (
                <li key={i}>
                  السطر {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
