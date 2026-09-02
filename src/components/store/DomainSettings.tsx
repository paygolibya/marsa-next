"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

type DomainRecord = { type: string; domain: string; value: string; reason: string };
type DomainState = {
  subdomain: string;
  customDomain: string | null;
  customDomainVerified: boolean;
  records: DomainRecord[];
};

export default function DomainSettings({ storeId }: { storeId: string }) {
  const { token } = useAuth();
  const [state, setState] = useState<DomainState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!token) return;
    setLoading(true);
    api
      .getDomain(token, storeId)
      .then((data) => {
        setState(data);
        setInput(data.customDomain ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "تعذّر تحميل إعدادات النطاق"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [token, storeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaving(true);
    try {
      await api.setCustomDomain(token, storeId, input.trim() || null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ النطاق");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!token || !window.confirm("إزالة النطاق المخصص؟ سيبقى متجرك متاحًا عبر الرابط الفرعي.")) return;
    setError(null);
    setSaving(true);
    try {
      await api.setCustomDomain(token, storeId, null);
      setInput("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إزالة النطاق");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-10 pt-10 border-t border-harbor/10 max-w-2xl">
      <h2 className="font-display text-xl font-extrabold text-harbor mb-1">النطاق</h2>
      <p className="text-sm text-rope mb-6">رابط متجرك الفرعي دائمًا متاح، ويمكنك ربط نطاقك الخاص إضافيًا.</p>

      {loading ? (
        <p className="text-rope">جارٍ التحميل...</p>
      ) : state ? (
        <div className="space-y-6">
          <div>
            <span className="block text-sm font-bold text-harbor mb-1.5">الرابط الفرعي</span>
            <a
              href={`https://${state.subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-block rounded-xl border border-harbor/15 bg-white px-4 py-3 text-sm text-brass hover:underline"
            >
              {state.subdomain}
            </a>
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">نطاق مخصص (اختياري)</span>
              <div className="flex gap-2">
                <input
                  dir="ltr"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="input flex-1"
                  placeholder="shop.example.com"
                />
                <button
                  type="submit"
                  disabled={saving || input.trim() === (state.customDomain ?? "")}
                  className="rounded-full bg-signal px-5 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {saving ? "..." : "حفظ"}
                </button>
              </div>
            </label>

            {state.customDomain && (
              <div className="rounded-xl border border-harbor/15 bg-white p-4">
                <div className="flex items-center justify-between mb-2">
                  <span dir="ltr" className="font-bold text-harbor text-sm">
                    {state.customDomain}
                  </span>
                  {state.customDomainVerified ? (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">✓ موثّق</span>
                  ) : (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">بانتظار التوثيق</span>
                  )}
                </div>

                {!state.customDomainVerified && (
                  <div className="text-sm text-rope space-y-3">
                    {state.records.length > 0 ? (
                      <>
                        <p>أضف سجل DNS التالي لدى مزوّد النطاق، ثم اضغط &quot;تحقق الآن&quot;:</p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse" dir="ltr">
                            <thead>
                              <tr className="text-right text-rope">
                                <th className="pb-1 pr-4">Type</th>
                                <th className="pb-1 pr-4">Name</th>
                                <th className="pb-1">Value</th>
                              </tr>
                            </thead>
                            <tbody className="font-mono">
                              {state.records.map((r, i) => (
                                <tr key={i} className="border-t border-harbor/10">
                                  <td className="py-1.5 pr-4">{r.type}</td>
                                  <td className="py-1.5 pr-4">{r.domain}</td>
                                  <td className="py-1.5 break-all">{r.value || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p>تم استلام طلبك — تواصل مع الدعم لإكمال ربط النطاق.</p>
                    )}
                    <button
                      type="button"
                      onClick={refresh}
                      className="rounded-full border border-harbor/20 px-4 py-1.5 text-sm font-bold text-harbor hover:bg-harbor/5"
                    >
                      تحقق الآن
                    </button>
                  </div>
                )}

                <button type="button" onClick={handleRemove} className="mt-3 text-sm text-signal hover:underline">
                  إزالة النطاق
                </button>
              </div>
            )}
          </form>

          {error && <p className="text-signal text-sm">{error}</p>}
        </div>
      ) : (
        error && <p className="text-signal text-sm">{error}</p>
      )}
    </div>
  );
}
