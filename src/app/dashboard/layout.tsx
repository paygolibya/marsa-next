"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import { useCurrentStore } from "@/lib/use-current-store";
import { getImpersonationFlag, exitImpersonation } from "@/lib/impersonation";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { ToastProvider } from "@/components/ui";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";

const navItems = [
  { href: "/dashboard", label: "نظرة عامة", icon: "📊" },
  { href: "/dashboard/products", label: "المنتجات", icon: "📦" },
  { href: "/dashboard/orders", label: "الطلبات", icon: "🧾" },
  { href: "/dashboard/design", label: "تصميم المتجر", icon: "🎨" },
  { href: "/dashboard/payouts", label: "المستحقات المالية", icon: "💰" },
  { href: "/dashboard/coupons", label: "كوبونات الخصم", icon: "🏷️" },
  { href: "/dashboard/analytics", label: "التحليلات", icon: "📈" },
  { href: "/dashboard/settings", label: "إعدادات المتجر", icon: "⚙️" },
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
  const { token, merchant, ready, logout, login, refreshMerchant } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { stores, store, selectStore, loading } = useCurrentStore();
  // Read once on mount — this is already a "use client" file doing other
  // client-only localStorage reads (useCurrentStore), so the same pattern
  // applies here. Set by admin/merchants/page.tsx's 🛠️ button.
  const [impersonation, setImpersonation] = useState(() => getImpersonationFlag());

  function handleExitImpersonation() {
    const restored = exitImpersonation();
    if (restored) login(restored.token, restored.merchant);
    setImpersonation(null);
    // Not /admin/merchants: this layout's own effect below
    // (isAdminMerchant(merchant) -> router.replace("/admin")) fires the
    // instant login() resolves the restored admin, and always wins the
    // race against a more specific target here. Pushing the same /admin
    // target it already redirects to makes the destination deterministic
    // instead of racy — confirmed by testing against staging, where
    // targeting /admin/merchants here landed on /admin anyway.
    router.push("/admin");
  }
  // The sidebar used to be a fixed 256px column always in the flex row —
  // fine on desktop, but on a phone it either crushed the page content
  // into an unusably narrow strip or forced horizontal scrolling. Below
  // `lg` it's now an off-canvas drawer behind a menu button, same pattern
  // already proven on SiteNav's mobile fix.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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

  if (merchant && !merchant.phoneVerified && !impersonation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center rounded-2xl bg-white shadow-xl p-8">
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

  if (merchant && merchant.subscriptionStatus !== "active" && !impersonation) {
    const copy = STATUS_COPY[merchant.subscriptionStatus] ?? STATUS_COPY.pending;
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center rounded-2xl bg-white shadow-xl p-8">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-3">{copy.title}</h1>
          <p className="text-rope mb-8">{copy.body}</p>
          <div className="flex items-center justify-center gap-3">
            {merchant.subscriptionStatus === "inactive" && (
              <Link
                href="/subscription"
                className="rounded-full bg-signal px-5 py-2.5 font-bold text-canvas hover:bg-signal-dark transition-colors"
              >
                اشترك الآن
              </Link>
            )}
            <button
              onClick={() => void refreshMerchant()}
              className="rounded-full border border-harbor/20 px-5 py-2.5 font-bold text-harbor hover:bg-harbor/5 transition-colors"
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

  const trialDaysLeft =
    merchant?.trialEndsAt && merchant.trialEndsAt === merchant.subscriptionEndDate
      ? Math.ceil((new Date(merchant.trialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

  const sidebarContent = (
    <>
      <div className="px-6 py-6 border-b border-canvas/10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
          <Image src="/logo.png" alt="رفقة" width={28} height={28} className="h-7 w-7 object-contain" />
          رفقة <span className="text-canvas/50 font-normal text-sm">من مرسى</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-canvas/70 hover:text-canvas transition-colors p-1" />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="إغلاق القائمة"
            className="lg:hidden p-1 text-canvas/70 hover:text-canvas"
          >
            ✕
          </button>
        </div>
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

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-sm font-bold transition-colors ${
              pathname === item.href ? "bg-canvas/10 text-canvas" : "text-canvas/60 hover:bg-canvas/5"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-canvas/10 text-sm">
        <p className="font-bold truncate">{merchant?.name}</p>
        <button onClick={logout} className="text-canvas/50 hover:text-canvas mt-1">
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Mobile top bar — only the parts a phone actually needs: a menu
            toggle and the store switcher/name, not the full sidebar. */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-harbor text-canvas px-4 py-3">
          <button type="button" onClick={() => setSidebarOpen(true)} aria-label="فتح القائمة" className="p-1.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-display font-extrabold text-sm truncate">{store?.name ?? "رفقة"}</span>
          <ThemeToggle className="text-canvas/70 hover:text-canvas p-1.5" />
        </div>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} aria-hidden />
        )}

        <aside
          className={`bg-harbor text-canvas flex flex-col fixed lg:sticky top-0 right-0 h-screen w-72 lg:w-64 shrink-0 z-50 transition-transform duration-300 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          }`}
        >
          {sidebarContent}
        </aside>

        {/* Kept on the plain cream background, NOT the new brand gradient —
            every dashboard page below puts its page title/subtitle directly
            on this background with no card behind it (e.g. dashboard/page.tsx's
            "نظرة عامة" + store name), and the muted `text-rope` used for
            those subtitles loses too much contrast against the vivid
            orange/red gradient to read reliably. Revisit if/when those
            headers get a proper backdrop treatment. */}
        <main className="flex-1 bg-canvas min-w-0">
          {impersonation && (
            <div className="bg-purple-100 border-b border-purple-300 px-4 sm:px-6 py-3 text-sm text-purple-900 flex flex-wrap items-center justify-between gap-2">
              <span>
                🛠️ تعمل الآن نيابة عن <strong>{impersonation.merchantName}</strong> (بواسطة {impersonation.adminName})
              </span>
              <button onClick={handleExitImpersonation} className="font-bold text-purple-700 hover:underline whitespace-nowrap">
                إنهاء والعودة للإدارة
              </button>
            </div>
          )}
          {trialDaysLeft !== null && trialDaysLeft >= 0 && (
            <div className="bg-brass/10 border-b border-brass/20 px-4 sm:px-6 py-3 text-sm text-harbor flex flex-wrap items-center justify-between gap-2">
              <span>
                ⏳ أنت في الفترة التجريبية المجانية —{" "}
                {trialDaysLeft === 0 ? "تنتهي اليوم" : `تنتهي خلال ${trialDaysLeft} يوم`}
              </span>
              <Link href="/subscription" className="font-bold text-brass hover:underline whitespace-nowrap">
                اشترك الآن
              </Link>
            </div>
          )}
          {!loading && store ? (
            // pb-24: clearance for the floating support-chat button
            // (SupportChatWidget, fixed bottom-5 left-5, h-14/h-12) —
            // without it, any page short enough that its own trailing
            // content lands near the bottom of the first viewport gets
            // that content covered by the button on load. Confirmed live
            // across several dashboard pages (a form's last textarea, a
            // payouts summary card). Doesn't fully prevent the button
            // from passing over content mid-scroll on longer pages — that
            // much is normal floating-widget behavior — but removes the
            // worst, most jarring case of it sitting on content the
            // instant a page loads.
            <div className="pb-24">{children}</div>
          ) : loading ? (
            <p className="p-10 text-rope">جارٍ التحميل...</p>
          ) : null}
        </main>
      </div>
      <SupportChatWidget />
    </ToastProvider>
  );
}
