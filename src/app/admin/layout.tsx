"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";

const navItems = [
  { href: "/admin", label: "لوحة التحكم", icon: "📊" },
  { href: "/admin/payments", label: "الدفعات", icon: "💰" },
  { href: "/admin/merchants", label: "التجار", icon: "👥" },
  { href: "/admin/orders", label: "الطلبات", icon: "📦" },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, merchant, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!isAdminMerchant(merchant)) {
      router.replace("/dashboard");
    }
  }, [ready, token, merchant, router]);

  if (!ready) return null;
  if (!token || !isAdminMerchant(merchant)) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full bg-harbor p-6 text-white lg:min-h-screen lg:w-64">
          <h1 className="mb-8 text-2xl font-bold">Marsa Admin</h1>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-4 py-2 transition hover:bg-harbor-dark"
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
