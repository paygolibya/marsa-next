"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import ThemeToggle from "@/components/layout/ThemeToggle";

export function SiteNav() {
  const { merchant, ready } = useAuth();
  // Transparent at the very top (showing the hero/gradient behind it), but
  // a solid backdrop once the page scrolls — a fully transparent header
  // stayed readable over the hero's own light background, but nav links
  // became hard to read once real content (white cards, product grids)
  // started scrolling underneath a still-transparent bar.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled ? "bg-canvas/90 backdrop-blur shadow-sm border-b border-harbor/10" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="رفقة" width={36} height={36} priority className="h-9 w-9 object-contain" />
          <span className="font-display text-xl font-extrabold text-harbor">
            رفقة <span className="text-rope font-normal text-sm">من مرسى</span>
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-medium text-harbor">
          <Link href="/#pricing" className="hover:text-brass transition-colors">
            الأسعار
          </Link>
          <Link href="/#features" className="hover:text-brass transition-colors">
            المزايا
          </Link>
          <ThemeToggle className="text-lg hover:opacity-70 transition-opacity" />
          {ready && merchant && isAdminMerchant(merchant) ? (
            <Link
              href="/admin"
              className="rounded-full bg-harbor px-5 py-2 text-canvas hover:bg-harbor-deep transition-colors"
            >
              لوحة الإدارة
            </Link>
          ) : ready && merchant && merchant.subscriptionStatus === "active" ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-harbor px-5 py-2 text-canvas hover:bg-harbor-deep transition-colors"
            >
              لوحة التحكم
            </Link>
          ) : ready && merchant ? (
            <Link href="/dashboard" className="text-rope hover:text-harbor transition-colors">
              حسابك قيد المراجعة
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-brass transition-colors">
                تسجيل الدخول
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-signal px-5 py-2 text-canvas hover:bg-signal-dark transition-colors"
              >
                ابدأ الآن
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
