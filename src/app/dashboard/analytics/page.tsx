"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD } from "@/lib/api";
import { CHART_COLORS } from "@/lib/design-tokens";
import { Card, EmptyState, Skeleton } from "@/components/ui";

type Analytics = {
  byDay: { date: string; orders: number; revenueCents: number }[];
  topProducts: { name: string; quantity: number; revenueCents: number }[];
};
type EventAnalytics = {
  funnel: { pageview: number; add_to_cart: number; checkout_started: number; order_completed: number };
  deviceBreakdown: { device: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  visitsOverTime: { date: string; pageviews: number }[];
};

const FUNNEL_LABELS: Record<keyof EventAnalytics["funnel"], string> = {
  pageview: "زيارات",
  add_to_cart: "إضافة للسلة",
  checkout_started: "بدء الدفع",
  order_completed: "طلب مكتمل",
};
const DEVICE_LABELS: Record<string, string> = { mobile: "الهاتف", desktop: "الحاسوب", tablet: "الجهاز اللوحي" };

export default function DashboardAnalyticsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [data, setData] = useState<Analytics | null>(null);
  const [eventData, setEventData] = useState<EventAnalytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!token || !store) return;
    setData(null);
    setEventData(null);
    api.analytics(token, store.id, days).then(setData);
    api.analyticsEvents(token, store.id, days).then(setEventData);
  }, [token, store, days]);

  if (!store) return null;

  const chartData = data?.byDay.map((d) => ({ ...d, revenue: d.revenueCents / 100, label: d.date.slice(5) })) ?? [];
  const totalRevenueCents = data?.byDay.reduce((sum, d) => sum + d.revenueCents, 0) ?? 0;
  const totalOrders = data?.byDay.reduce((sum, d) => sum + d.orders, 0) ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <h1 className="font-display text-2xl font-extrabold text-harbor">التحليلات</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                days === d ? "bg-harbor text-canvas" : "bg-white text-harbor border border-harbor/10 shadow-sm"
              }`}
            >
              {d} يومًا
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10">
        <Card className="p-6">
          <p className="text-rope text-sm">إجمالي المبيعات</p>
          {data === null ? (
            <Skeleton className="h-9 w-32 mt-2" />
          ) : (
            <p className="font-display text-3xl font-extrabold text-harbor mt-2">{formatLYD(totalRevenueCents)}</p>
          )}
        </Card>
        <Card className="p-6">
          <p className="text-rope text-sm">عدد الطلبات</p>
          {data === null ? <Skeleton className="h-9 w-16 mt-2" /> : <p className="font-display text-3xl font-extrabold text-harbor mt-2">{totalOrders}</p>}
        </Card>
      </div>

      <Card className="p-4 sm:p-6 mb-10">
        <h2 className="font-bold text-harbor mb-4">المبيعات عبر الوقت</h2>
        {data === null ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.canvasDim} />
                <XAxis dataKey="label" stroke={CHART_COLORS.harbor} fontSize={12} />
                <YAxis stroke={CHART_COLORS.harbor} fontSize={12} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)} د.ل`} />
                <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.brass} fill={CHART_COLORS.brass} fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-bold text-harbor mb-4">أفضل المنتجات مبيعًا</h2>
        {data === null ? (
          <Skeleton className="h-[280px] w-full" />
        ) : data.topProducts.length ? (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.topProducts.map((p) => ({ ...p, revenue: p.revenueCents / 100 }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.canvasDim} />
                <XAxis type="number" stroke={CHART_COLORS.harbor} fontSize={12} />
                <YAxis type="category" dataKey="name" width={120} stroke={CHART_COLORS.harbor} fontSize={12} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)} د.ل`} />
                <Bar dataKey="revenue" fill={CHART_COLORS.signal} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="لا توجد بيانات كافية بعد" className="py-8" />
        )}
      </Card>

      <Card className="p-4 sm:p-6 mt-10">
        <h2 className="font-bold text-harbor mb-4">الزيارات عبر الوقت</h2>
        {eventData === null ? (
          <Skeleton className="h-[280px] w-full" />
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={eventData.visitsOverTime.map((d) => ({ ...d, label: d.date.slice(5) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.canvasDim} />
                <XAxis dataKey="label" stroke={CHART_COLORS.harbor} fontSize={12} />
                <YAxis stroke={CHART_COLORS.harbor} fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="pageviews" stroke={CHART_COLORS.harbor} fill={CHART_COLORS.harbor} fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-10">
        <Card className="p-4 sm:p-6">
          <h2 className="font-bold text-harbor mb-4">قمع التحويل</h2>
          {eventData === null ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart
                  data={(Object.keys(FUNNEL_LABELS) as (keyof EventAnalytics["funnel"])[]).map((key) => ({
                    stage: FUNNEL_LABELS[key],
                    count: eventData.funnel[key],
                  }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.canvasDim} />
                  <XAxis type="number" stroke={CHART_COLORS.harbor} fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" width={90} stroke={CHART_COLORS.harbor} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.brass} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-bold text-harbor mb-4">الأجهزة</h2>
          {eventData === null ? (
            <Skeleton className="h-[220px] w-full" />
          ) : eventData.deviceBreakdown.length ? (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart
                  data={eventData.deviceBreakdown.map((d) => ({ device: DEVICE_LABELS[d.device] ?? d.device, count: d.count }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.canvasDim} />
                  <XAxis type="number" stroke={CHART_COLORS.harbor} fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="device" width={90} stroke={CHART_COLORS.harbor} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill={CHART_COLORS.signal} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="لا توجد بيانات كافية بعد" className="py-8" />
          )}
        </Card>
      </div>

      <Card className="p-4 sm:p-6 mt-10">
        <h2 className="font-bold text-harbor mb-4">أهم مصادر الزيارات</h2>
        {eventData === null ? (
          <Skeleton className="h-24 w-full" />
        ) : eventData.topReferrers.length ? (
          <ul className="divide-y divide-harbor/5">
            {eventData.topReferrers.map((r) => (
              <li key={r.referrer} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-harbor truncate" dir="ltr">
                  {r.referrer}
                </span>
                <span className="font-bold text-harbor shrink-0 mr-4">{r.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="لا توجد بيانات كافية بعد" className="py-8" />
        )}
      </Card>
    </div>
  );
}
