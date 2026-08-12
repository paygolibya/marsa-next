"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, formatLYD } from "@/lib/api";

const COLORS = { harbor: "#0E2A3F", brass: "#B8752E", signal: "#C1443C", canvasDim: "#E4DCC8" };

type Analytics = {
  byDay: { date: string; orders: number; revenueCents: number }[];
  topProducts: { name: string; quantity: number; revenueCents: number }[];
};

export default function DashboardAnalyticsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!token || !store) return;
    api.analytics(token, store.id, days).then(setData);
  }, [token, store, days]);

  if (!store) return null;

  const chartData = data?.byDay.map((d) => ({ ...d, revenue: d.revenueCents / 100, label: d.date.slice(5) })) ?? [];
  const totalRevenueCents = data?.byDay.reduce((sum, d) => sum + d.revenueCents, 0) ?? 0;
  const totalOrders = data?.byDay.reduce((sum, d) => sum + d.orders, 0) ?? 0;

  return (
    <div className="p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-extrabold text-harbor">التحليلات</h1>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                days === d ? "bg-harbor text-canvas" : "bg-white/60 text-harbor border border-harbor/10"
              }`}
            >
              {d} يومًا
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-10">
        <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
          <p className="text-rope text-sm">إجمالي المبيعات</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{formatLYD(totalRevenueCents)}</p>
        </div>
        <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
          <p className="text-rope text-sm">عدد الطلبات</p>
          <p className="font-display text-3xl font-extrabold text-harbor mt-2">{totalOrders}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6 mb-10">
        <h2 className="font-bold text-harbor mb-4">المبيعات عبر الوقت</h2>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.canvasDim} />
              <XAxis dataKey="label" stroke={COLORS.harbor} fontSize={12} />
              <YAxis stroke={COLORS.harbor} fontSize={12} />
              <Tooltip formatter={(value) => `${Number(value).toFixed(2)} د.ل`} />
              <Area type="monotone" dataKey="revenue" stroke={COLORS.brass} fill={COLORS.brass} fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-harbor/10 bg-white/50 p-6">
        <h2 className="font-bold text-harbor mb-4">أفضل المنتجات مبيعًا</h2>
        {data?.topProducts.length ? (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.topProducts.map((p) => ({ ...p, revenue: p.revenueCents / 100 }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.canvasDim} />
                <XAxis type="number" stroke={COLORS.harbor} fontSize={12} />
                <YAxis type="category" dataKey="name" width={120} stroke={COLORS.harbor} fontSize={12} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(2)} د.ل`} />
                <Bar dataKey="revenue" fill={COLORS.signal} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-rope text-sm">لا توجد بيانات كافية بعد.</p>
        )}
      </div>
    </div>
  );
}
