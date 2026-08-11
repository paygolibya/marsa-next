"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface VanexArea {
  id: number;
  name?: string;
}

interface VanexPickup {
  id: number;
  status?: number | string;
  address?: string;
  phone?: string;
  num_pkg?: number;
  [key: string]: unknown;
}

const statusTabs: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: "قيد الانتظار" },
  { value: 2, label: "مكتمل" },
  { value: 3, label: "ملغى" },
];

export default function AdminVanexPage() {
  const { token } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [citiesCount, setCitiesCount] = useState<number | null>(null);

  const [pickupStatus, setPickupStatus] = useState<1 | 2 | 3>(1);
  const [pickups, setPickups] = useState<VanexPickup[]>([]);
  const [loadingPickups, setLoadingPickups] = useState(true);

  const [phone, setPhone] = useState("");
  const [backupPhone, setBackupPhone] = useState("");
  const [numberOfPackages, setNumberOfPackages] = useState(1);
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    void fetchStoredCities();
  }, []);

  useEffect(() => {
    void fetchPickups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupStatus, token]);

  async function fetchStoredCities() {
    try {
      const res = await fetch("/api/vanex/cities");
      if (res.ok) {
        const data = await res.json();
        const areas = (data.cities as { areas: VanexArea[] }[]).reduce((sum, c) => sum + c.areas.length, 0);
        setCitiesCount(data.cities.length ? data.cities.length : 0);
        setSyncResult((prev) => prev ?? (data.cities.length ? `${data.cities.length} مدينة، ${areas} منطقة مخزّنة حاليًا` : null));
      }
    } catch {
      // best-effort, ignore
    }
  }

  async function syncCities() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/vanex/sync-cities", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`✓ تمت المزامنة: ${data.cities} مدينة، ${data.areas} منطقة`);
        setCitiesCount(data.cities);
      } else {
        setSyncResult(data.error || "فشلت المزامنة");
      }
    } catch {
      setSyncResult("فشلت المزامنة");
    } finally {
      setSyncing(false);
    }
  }

  async function fetchPickups() {
    if (!token) return;
    setLoadingPickups(true);
    try {
      const res = await fetch(`/api/admin/vanex/pickups?status=${pickupStatus}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPickups(Array.isArray(data.pickups) ? data.pickups : []);
      }
    } catch {
      // best-effort
    } finally {
      setLoadingPickups(false);
    }
  }

  async function requestPickup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !address || !mapUrl || numberOfPackages < 1) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/admin/vanex/pickups", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ phone, backupPhone: backupPhone || undefined, numberOfPackages, address, mapUrl, notes: notes || undefined }),
      });
      if (res.ok) {
        alert("✓ تم إرسال طلب الاستلام");
        setPhone("");
        setBackupPhone("");
        setNumberOfPackages(1);
        setAddress("");
        setMapUrl("");
        setNotes("");
        setPickupStatus(1);
        await fetchPickups();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "فشل طلب الاستلام");
      }
    } catch {
      alert("حدث خطأ");
    } finally {
      setRequesting(false);
    }
  }

  async function cancelPickup(id: number) {
    if (!window.confirm("تأكيد إلغاء طلب الاستلام؟")) return;
    try {
      const res = await fetch(`/api/admin/vanex/pickups/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.ok) {
        await fetchPickups();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "فشل الإلغاء");
      }
    } catch {
      alert("حدث خطأ");
    }
  }

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">الشحن (Vanex)</h1>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-2 text-xl font-bold">مدن وأسعار الشحن</h2>
        <p className="mb-4 text-sm text-gray-600">
          {citiesCount !== null ? `${citiesCount} مدينة مخزّنة حاليًا` : "لم تتم المزامنة بعد"}
        </p>
        <button
          onClick={() => void syncCities()}
          disabled={syncing}
          className="rounded-lg bg-harbor px-6 py-2 font-bold text-white transition hover:bg-harbor-deep disabled:opacity-50"
        >
          {syncing ? "جاري المزامنة..." : "مزامنة المدن الآن"}
        </button>
        {syncResult && <p className="mt-3 text-sm text-gray-700">{syncResult}</p>}
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold">طلب استلام جديد</h2>
        <form onSubmit={requestPickup} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">الهاتف</span>
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">هاتف احتياطي (اختياري)</span>
            <input dir="ltr" value={backupPhone} onChange={(e) => setBackupPhone(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-gray-700">عدد الطرود</span>
            <input
              required
              type="number"
              min={1}
              value={numberOfPackages}
              onChange={(e) => setNumberOfPackages(Number(e.target.value))}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-gray-700">العنوان</span>
            <input required value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-gray-700">رابط الموقع (Google Maps)</span>
            <input
              required
              dir="ltr"
              type="url"
              placeholder="https://maps.google.com/?q=..."
              value={mapUrl}
              onChange={(e) => setMapUrl(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-gray-700">ملاحظات (اختياري)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border px-3 py-2" />
          </label>
          <button
            type="submit"
            disabled={requesting}
            className="sm:col-span-2 rounded-lg bg-signal py-2 font-bold text-white transition hover:bg-signal-dark disabled:opacity-50"
          >
            {requesting ? "جاري الإرسال..." : "طلب الاستلام"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">طلبات الاستلام</h2>
          <div className="flex gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setPickupStatus(tab.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                  pickupStatus === tab.value ? "bg-harbor text-white" : "border border-gray-200 text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loadingPickups ? (
          <p className="text-gray-600">جاري التحميل...</p>
        ) : pickups.length === 0 ? (
          <p className="text-gray-600">لا توجد طلبات استلام</p>
        ) : (
          <div className="space-y-3">
            {pickups.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
                <div>
                  <p className="font-bold">{p.address || "—"}</p>
                  <p className="text-sm text-gray-600" dir="ltr">
                    {p.phone} — {p.num_pkg} طرد
                  </p>
                </div>
                {pickupStatus === 1 && (
                  <button
                    onClick={() => void cancelPickup(p.id)}
                    className="rounded bg-red-600 px-3 py-1 text-sm font-bold text-white hover:bg-red-700"
                  >
                    إلغاء
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
