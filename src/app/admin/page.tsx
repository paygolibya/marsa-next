"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

type Stats = {
  merchants: number;
  orders: number;
  revenue: number;
  pendingPayments: number;
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats>({ merchants: 0, orders: 0, revenue: 0, pendingPayments: 0 });
  const [pendingSignups, setPendingSignups] = useState<Array<{ id: string; name: string; phone: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStats();
  }, [token]);

  async function fetchStats() {
    try {
      const [statsResponse, merchantsResponse] = await Promise.all([
        fetch("/api/admin/stats", { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
        fetch("/api/admin/merchants", { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
      ]);

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data);
      }

      if (merchantsResponse.ok) {
        const data = await merchantsResponse.json();
        setPendingSignups(
          (data.merchants || [])
            .filter((merchant: { subscriptionStatus?: string }) => merchant.subscriptionStatus !== "active")
            .slice(0, 5)
            .map((merchant: { id: string; name: string; phone: string; createdAt: string }) => ({
              id: merchant.id,
              name: merchant.name,
              phone: merchant.phone,
              createdAt: merchant.createdAt,
            }))
        );
      }
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p className="text-rope">جاري التحميل...</p>;

  return (
    <div>
      <h1 className="mb-8 text-4xl font-bold text-harbor">لوحة التحكم</h1>

      <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard title="التجار" value={stats.merchants} color="blue" />
        <StatCard title="الطلبات" value={stats.orders} color="green" />
        <StatCard title="الإيرادات" value={`${stats.revenue} د.ل`} color="yellow" />
        <StatCard title="الدفعات المعلقة" value={stats.pendingPayments} color="red" />
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold">طلبات التسجيل</h2>
        {pendingSignups.length === 0 ? (
          <p className="text-rope">لا توجد طلبات تسجيل جديدة.</p>
        ) : (
          <div className="space-y-3">
            {pendingSignups.map((signup) => (
              <div key={signup.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-harbor">{signup.name}</p>
                    <p className="text-sm text-rope">{signup.phone}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                    في الانتظار
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-2xl font-bold">الإجراءات السريعة</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction href="/admin/payments" title="مراجعة الدفعات" icon="💰" color="blue" />
          <QuickAction href="/admin/merchants" title="التجار" icon="👥" color="green" />
          <QuickAction href="/admin/orders" title="الطلبات" icon="📦" color="yellow" />
          <QuickAction href="/admin/settings" title="الإعدادات" icon="⚙️" color="purple" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  const colors = {
    blue: "border-blue-200 bg-blue-50",
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
    red: "border-red-200 bg-red-50",
  } as const;

  return (
    <div className={`rounded-lg border p-6 ${colors[color as keyof typeof colors]}`}>
      <p className="mb-2 text-gray-600">{title}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function QuickAction({ href, title, icon, color }: { href: string; title: string; icon: string; color: string }) {
  const colors = {
    blue: "bg-blue-50 hover:bg-blue-100",
    green: "bg-green-50 hover:bg-green-100",
    yellow: "bg-yellow-50 hover:bg-yellow-100",
    purple: "bg-purple-50 hover:bg-purple-100",
  } as const;

  return (
    <Link href={href} className={`rounded-lg p-4 text-center transition ${colors[color as keyof typeof colors]}`}>
      <div className="mb-2 text-2xl">{icon}</div>
      <div className="font-bold">{title}</div>
    </Link>
  );
}
