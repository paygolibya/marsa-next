"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Coupon } from "@/lib/api";

export default function DashboardCouponsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxUsage, setMaxUsage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function refresh() {
    if (!token || !store) return;
    api.listCoupons(token, store.id).then(setCoupons);
  }

  useEffect(refresh, [token, store]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setError(null);
    setSaving(true);
    try {
      await api.createCoupon(token, {
        storeId: store.id,
        code,
        discountType,
        discountValue: discountType === "percent" ? Number(discountValue) : Math.round(parseFloat(discountValue) * 100),
        maxUsage: maxUsage ? Number(maxUsage) : null,
      });
      setCode("");
      setDiscountValue("");
      setMaxUsage("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إنشاء الكوبون");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    if (!token) return;
    await api.updateCoupon(token, coupon.id, { active: !coupon.active });
    refresh();
  }

  async function handleDelete(id: string) {
    if (!token) return;
    await api.deleteCoupon(token, id);
    refresh();
  }

  if (!store) return null;

  return (
    <div className="p-10 grid md:grid-cols-[1fr_1.4fr] gap-10">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">أنشئ كوبونًا</h1>
        <form onSubmit={handleCreate} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رمز الكوبون</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
              dir="ltr"
              placeholder="SAVE10"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">نوع الخصم</span>
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")} className="input">
                <option value="percent">نسبة مئوية %</option>
                <option value="fixed">مبلغ ثابت (د.ل)</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{discountType === "percent" ? "النسبة %" : "المبلغ (د.ل)"}</span>
              <input
                required
                type="number"
                min="1"
                step={discountType === "percent" ? "1" : "0.01"}
                max={discountType === "percent" ? "100" : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="input"
                dir="ltr"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">الحد الأقصى للاستخدام (اختياري)</span>
            <input type="number" min="1" value={maxUsage} onChange={(e) => setMaxUsage(e.target.value)} className="input" dir="ltr" />
          </label>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {saving ? "جارٍ الإنشاء..." : "إنشاء الكوبون"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-display text-2xl font-extrabold text-harbor mb-6">الكوبونات</h2>
        {coupons.length === 0 ? (
          <p className="text-rope">لا توجد كوبونات بعد.</p>
        ) : (
          <ul className="space-y-3">
            {coupons.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-harbor/10 bg-white/50 px-5 py-3">
                <div>
                  <p className="font-bold text-harbor" dir="ltr">
                    {c.code}
                  </p>
                  <p className="text-rope text-sm">
                    {c.discountType === "percent" ? `${c.discountValue}%` : formatLYD(c.discountValue)} · استُخدم {c.usageCount}
                    {c.maxUsage ? ` / ${c.maxUsage}` : ""} مرة
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleActive(c)} className="text-harbor text-sm font-bold hover:underline">
                    {c.active ? "إيقاف" : "تفعيل"}
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-signal text-sm font-bold hover:underline">
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
