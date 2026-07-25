"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Product } from "@/lib/api";

export default function DashboardProductsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      await api.createProduct(token, { storeId: store.id, name, priceCents, imageUrl: imageUrl || null });
      setName("");
      setPrice("");
      setImageUrl("");
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
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رابط الصورة (اختياري)</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input" dir="ltr" />
          </label>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {saving ? "جارٍ الإضافة..." : "إضافة المنتج"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-display text-2xl font-extrabold text-harbor mb-6">منتجاتك</h2>
        {products.length === 0 ? (
          <p className="text-rope">لا توجد منتجات بعد.</p>
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-harbor/10 bg-white/50 px-5 py-3"
              >
                <div>
                  <p className="font-bold text-harbor">{p.name}</p>
                  <p className="text-rope text-sm">{formatLYD(p.priceCents)}</p>
                </div>
                <button onClick={() => handleDelete(p.id)} className="text-signal text-sm font-bold hover:underline">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
