"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError } from "@/lib/api";
import DomainSettings from "@/components/store/DomainSettings";

export default function DashboardSettingsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [aboutText, setAboutText] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!store) return;
    setAboutText(store.aboutText ?? "");
    setReturnPolicy(store.returnPolicy ?? "");
    setShippingPolicy(store.shippingPolicy ?? "");
    setBusinessHours(store.businessHours ?? "");
  }, [store]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await api.updateStoreSettings(token, store.id, {
        aboutText: aboutText || null,
        returnPolicy: returnPolicy || null,
        shippingPolicy: shippingPolicy || null,
        businessHours: businessHours || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  if (!store) return null;

  return (
    <div className="p-10 max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">إعدادات المتجر</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">عن المتجر</span>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="input"
            rows={3}
            placeholder="نبذة قصيرة عن متجرك"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">سياسة الإرجاع</span>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            className="input"
            rows={4}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">سياسة الشحن</span>
          <textarea
            value={shippingPolicy}
            onChange={(e) => setShippingPolicy(e.target.value)}
            className="input"
            rows={4}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">ساعات العمل</span>
          <input
            value={businessHours}
            onChange={(e) => setBusinessHours(e.target.value)}
            className="input"
            placeholder="السبت–الخميس: 9ص–9م"
          />
        </label>

        {error && <p className="text-signal text-sm">{error}</p>}
        {saved && <p className="text-sm text-green-700">✓ تم الحفظ</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-signal px-6 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
        </button>
      </form>

      <DomainSettings storeId={store.id} />
    </div>
  );
}
