"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import { useCurrentStore } from "@/lib/use-current-store";

const navItems = [
  { href: "/dashboard", label: "نظرة عامة" },
  { href: "/dashboard/products", label: "المنتجات" },
  { href: "/dashboard/orders", label: "الطلبات" },
  { href: "/dashboard/payouts", label: "المستحقات المالية" },
  { href: "/dashboard/coupons", label: "كوبونات الخصم" },
  { href: "/dashboard/analytics", label: "التحليلات" },
  { href: "/dashboard/settings", label: "إعدادات المتجر" },
];

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: "حسابك قيد المراجعة",
    body: "استلمنا طلبك وسيقوم فريقنا بمراجعته وتفعيل حسابك قريبًا.",
  },
  inactive: {
    title: "لم يتم تفعيل حسابك بعد",
    body: "أكمل الاشتراك ورفع إيصال الدفع، وسنقوم بتفعيل حسابك بعد المراجعة.",
  },
  rejected: {
    title: "تم رفض طلبك",
    body: "تواصل معنا لمعرفة السبب أو لإعادة تقديم طلبك.",
  },
  suspended: {
    title: "تم إيقاف حسابك مؤقتًا",
    body: "تواصل مع الدعم لمعرفة التفاصيل وإعادة تفعيل حسابك.",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, merchant, ready, logout, refreshMerchant } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { stores, store, selectStore, loading } = useCurrentStore();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  useEffect(() => {
    if (ready && token && isAdminMerchant(merchant)) router.replace("/admin");
  }, [ready, token, merchant, router]);

  useEffect(() => {
    if (!loading && ready && token && !isAdminMerchant(merchant) && merchant?.phoneVerified && stores.length === 0) {
      router.replace("/onboarding");
    }
  }, [loading, ready, token, merchant, stores.length, router]);

  if (!ready || !token || isAdminMerchant(merchant)) return null;

  if (merchant && !merchant.phoneVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-3">تحقق من رقم هاتفك</h1>
          <p className="text-rope mb-8">لم يتم التحقق من رقم هاتفك بعد — أكمل خطوة التحقق للمتابعة.</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/verify-phone"
              className="rounded-full bg-signal px-5 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors"
            >
              التحقق الآن
            </Link>
            <button onClick={logout} className="text-rope hover:text-harbor transition-colors">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (merchant && merchant.subscriptionStatus !== "active") {
    const copy = STATUS_COPY[merchant.subscriptionStatus] ?? STATUS_COPY.pending;
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-3">{copy.title}</h1>
          <p className="text-rope mb-8">{copy.body}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => void refreshMerchant()}
              className="rounded-full bg-signal px-5 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors"
            >
              تحقق من الحالة
            </button>
            <button onClick={logout} className="text-rope hover:text-harbor transition-colors">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 shrink-0 bg-harbor text-canvas flex flex-col">
        <div className="px-6 py-6 border-b border-canvas/10">
          <Link href="/" className="font-display text-lg font-extrabold">
            رفقة <span className="text-canvas/50 font-normal text-sm">من مرسى</span>
          </Link>
        </div>

        {stores.length > 1 && (
          <div className="px-6 py-4 border-b border-canvas/10">
            <label className="block text-xs text-canvas/50 mb-1">المتجر</label>
            <select
              value={store?.id ?? ""}
              onChange={(e) => selectStore(e.target.value)}
              className="w-full rounded-lg bg-harbor-deep border border-canvas/20 px-3 py-2 text-sm"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
                pathname === item.href ? "bg-canvas/10 text-canvas" : "text-canvas/60 hover:bg-canvas/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-6 py-4 border-t border-canvas/10 text-sm">
          <p className="font-bold">{merchant?.name}</p>
          <button onClick={logout} className="text-canvas/50 hover:text-canvas mt-1">
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="flex-1 bg-canvas">
        {!loading && store ? (
          children
        ) : loading ? (
          <p className="p-10 text-rope">جارٍ التحميل...</p>
        ) : null}
      </main>
    </div>
  );
}
