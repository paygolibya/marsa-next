"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import { api, formatLYD, type DriverOrder } from "@/lib/api";
import { Badge, Button, EmptyState } from "@/components/ui";

// /driver — Rifqa's own Tripoli delivery team. Today's own-team orders,
// grouped by service level, with one-tap status updates. Admins only for
// now (same client-side gate as /admin; the real check is server-side in
// /api/driver/orders). Mobile-first: drivers use this on their phones.

const LEVEL_LABELS: Record<DriverOrder["deliveryServiceLevel"], string> = {
  SAME_DAY: "توصيل نفس اليوم — قبل 9:00 مساءً",
  NEXT_MORNING: "توصيل الصباح — قبل 12:00 ظهرًا",
};

const STATUS_LABELS: Record<NonNullable<DriverOrder["deliveryStatus"]>, string> = {
  PENDING: "بانتظار الاستلام",
  PICKED_UP: "تم الاستلام",
  OUT_FOR_DELIVERY: "في الطريق",
  DELIVERED: "تم التسليم",
  FAILED: "فشل التسليم",
};

const STATUS_TONES = {
  PENDING: "neutral",
  PICKED_UP: "info",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  FAILED: "danger",
} as const;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-LY", { timeZone: "Africa/Tripoli", hour: "numeric", minute: "2-digit" });
}

function OrderCard({ order, token, onChanged }: { order: DriverOrder; token: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [cash, setCash] = useState(String(order.amountToCollectCents / 100));
  const done = order.deliveryStatus === "DELIVERED";

  async function update(status: "PICKED_UP" | "DELIVERED" | "FAILED", cashCollectedCents?: number) {
    setBusy(status);
    setError(null);
    try {
      await api.updateDriverStatus(token, order.id, status, cashCollectedCents);
      setCollecting(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ");
    } finally {
      setBusy(null);
    }
  }

  function confirmDelivered() {
    if (order.amountToCollectCents === 0) return update("DELIVERED", 0);
    const value = Number(cash.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      setError("أدخل المبلغ المحصّل");
      return;
    }
    return update("DELIVERED", Math.round(value * 100));
  }

  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${done ? "border-green-200 opacity-70" : "border-harbor/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-harbor text-lg">{order.buyerName}</p>
          <p className="text-sm text-rope">{order.store.name}</p>
        </div>
        <Badge tone={STATUS_TONES[order.deliveryStatus ?? "PENDING"]}>{STATUS_LABELS[order.deliveryStatus ?? "PENDING"]}</Badge>
      </div>

      <p className="mt-3 text-harbor leading-relaxed">
        <span className="font-bold">{order.buyerCity}</span>
        <br />
        {order.buyerAddress}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${order.buyerPhone}`} className="flex min-h-[48px] items-center justify-center rounded-xl border border-harbor/15 font-bold text-harbor" dir="ltr">
          {order.buyerPhone}
        </a>
        <a href={`tel:${order.store.merchant.phone}`} className="flex min-h-[48px] items-center justify-center rounded-xl border border-harbor/15 text-sm text-rope">
          اتصل بالمتجر
        </a>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-canvas-dim px-4 py-3">
        <span className="text-sm text-rope">المبلغ المطلوب تحصيله</span>
        <span className="text-xl font-extrabold text-harbor">{formatLYD(order.amountToCollectCents)}</span>
      </div>
      {order.items.length > 0 && (
        <p className="mt-2 text-sm text-rope">
          {order.items.map((i) => `${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""} × ${i.quantity}`).join("، ")}
        </p>
      )}
      <p className="mt-1 text-xs text-rope">الموعد: قبل {timeLabel(order.promisedBy)}</p>
      {done && order.cashCollectedCents !== null && <p className="mt-2 text-sm font-bold text-green-700">تم تحصيل {formatLYD(order.cashCollectedCents)}</p>}

      {!done && (
        <div className="mt-4 space-y-2">
          {collecting ? (
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-harbor">المبلغ المحصّل (د.ل)</span>
                <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} className="input text-lg" dir="ltr" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" onClick={confirmDelivered} loading={busy === "DELIVERED"}>
                  تأكيد التسليم
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setCollecting(false)} disabled={busy !== null}>
                  رجوع
                </Button>
              </div>
            </div>
          ) : (
            <>
              {order.deliveryStatus === "PENDING" || order.deliveryStatus === null ? (
                <Button size="lg" className="w-full" variant="secondary" onClick={() => update("PICKED_UP")} loading={busy === "PICKED_UP"}>
                  تم الاستلام من المتجر
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  onClick={() => (order.amountToCollectCents > 0 ? setCollecting(true) : update("DELIVERED", 0))}
                  loading={busy === "DELIVERED"}
                  disabled={busy !== null}
                >
                  تم التسليم
                </Button>
                <Button size="lg" variant="danger" onClick={() => update("FAILED")} loading={busy === "FAILED"} disabled={busy !== null}>
                  فشل التسليم
                </Button>
              </div>
            </>
          )}
          {error && <p className="text-sm text-signal">{error}</p>}
        </div>
      )}
    </li>
  );
}

export default function DriverPage() {
  const router = useRouter();
  const { token, merchant, ready } = useAuth();
  const [data, setData] = useState<{ date: string; orders: DriverOrder[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) router.replace("/login");
    else if (!isAdminMerchant(merchant)) router.replace("/dashboard");
  }, [ready, token, merchant, router]);

  const load = useCallback(() => {
    if (!token) return;
    api
      .driverOrders(token)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "تعذّر التحميل"));
  }, [token]);

  useEffect(() => {
    load();
    // Pick up new orders while the driver is out, without a manual reload.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!ready || !token || !isAdminMerchant(merchant)) return null;

  const groups: DriverOrder["deliveryServiceLevel"][] = ["SAME_DAY", "NEXT_MORNING"];

  return (
    <main className="min-h-screen bg-canvas pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-harbor px-4 py-4 text-white">
        <div>
          <h1 className="font-display text-xl font-extrabold">توصيلات اليوم</h1>
          {data && <p className="text-sm text-white/70" dir="ltr">{data.date}</p>}
        </div>
        <Button variant="secondary" size="md" onClick={load}>
          تحديث
        </Button>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {error && <p className="mb-4 rounded-xl bg-signal/10 p-3 text-signal">{error}</p>}
        {!data && !error && <p className="py-10 text-center text-rope">جارٍ التحميل…</p>}
        {data && data.orders.length === 0 && <EmptyState icon="truck" title="لا توجد توصيلات اليوم" description="ستظهر طلبات طرابلس هنا تلقائيًا." />}

        {data &&
          groups.map((level) => {
            const orders = data.orders.filter((o) => o.deliveryServiceLevel === level);
            if (orders.length === 0) return null;
            const remaining = orders.filter((o) => o.deliveryStatus !== "DELIVERED").length;
            return (
              <section key={level} className="mb-8">
                <h2 className="mb-3 flex items-center justify-between font-bold text-harbor">
                  <span>{LEVEL_LABELS[level]}</span>
                  <span className="text-sm text-rope">
                    {remaining} متبقٍ من {orders.length}
                  </span>
                </h2>
                <ul className="space-y-3">
                  {orders.map((order) => (
                    <OrderCard key={order.id} order={order} token={token} onChanged={load} />
                  ))}
                </ul>
              </section>
            );
          })}
      </div>
    </main>
  );
}
