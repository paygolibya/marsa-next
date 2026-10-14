"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { Icon, type IconName } from "@/components/ui";

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/admin/escalations", label: "المشاكل المُصعّدة", icon: "alert" },
  { href: "/admin/payments", label: "الدفعات", icon: "card" },
  { href: "/admin/payouts", label: "مستحقات التجار", icon: "bank" },
  { href: "/admin/cron-logs", label: "سجل المهام التلقائية", icon: "clock" },
  { href: "/admin/merchants", label: "التجار", icon: "users" },
  { href: "/admin/orders", label: "الطلبات", icon: "package" },
  { href: "/admin/vanex", label: "الشحن (Vanex)", icon: "truck" },
  { href: "/admin/settings", label: "الإعدادات", icon: "settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
        <aside className="w-full bg-harbor text-canvas lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 flex flex-col">
          <div className="px-5 py-5 lg:py-6 flex items-center justify-between border-b border-canvas/10">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={24} height={28} className="h-7 w-auto object-contain" />
              <div>
                <p className="font-display text-lg font-extrabold leading-tight">رفقة</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brass">Admin</p>
              </div>
            </div>
            <ThemeToggle className="text-canvas/70 hover:text-canvas transition-colors" />
          </div>

          {/* A horizontally scrolling chip row on mobile (the old stacked
              list pushed every admin page's actual content a full screen
              down), a normal vertical list from lg up. */}
          <nav aria-label="الإدارة" className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-y-auto px-3 py-3 lg:py-4 lg:flex-1">
            {navItems.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex shrink-0 min-h-[44px] items-center gap-3 whitespace-nowrap rounded-xl px-4 text-sm font-bold transition-colors duration-150 ${
                    active ? "bg-canvas/10 text-canvas" : "text-canvas/60 hover:bg-canvas/5 hover:text-canvas"
                  }`}
                >
                  {active && <span className="hidden lg:block absolute inset-y-2 right-0 w-1 rounded-l-full bg-brass" aria-hidden />}
                  <Icon name={item.icon} size={19} className={active ? "text-brass" : "text-canvas/50"} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
