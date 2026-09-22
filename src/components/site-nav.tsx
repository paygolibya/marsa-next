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
  // The full row (logo text + 2 links + theme toggle + auth button) never
  // fit a real phone width — on Android it visibly wrapped and overlapped
  // (the logo subtitle broke onto its own line, "الأسعار" overlapped the
  // bag icon, "ابدأ الآن" ran off the left edge). Below `md` this collapses
  // to logo + a menu toggle instead of trying to force everything into one row.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on route change / resize past the breakpoint,
  // so it can't be left open and stuck over the page.
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const authLinks =
    ready && merchant && isAdminMerchant(merchant) ? (
      <Link
        href="/admin"
        className="rounded-full bg-harbor px-5 py-2 text-center text-canvas hover:bg-harbor-deep transition-colors"
      >
        لوحة الإدارة
      </Link>
    ) : ready && merchant && merchant.subscriptionStatus === "active" ? (
      <Link
        href="/dashboard"
        className="rounded-full bg-harbor px-5 py-2 text-center text-canvas hover:bg-harbor-deep transition-colors"
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
          className="rounded-full bg-signal px-5 py-2 text-center text-canvas hover:bg-signal-dark transition-colors"
        >
          ابدأ الآن
        </Link>
      </>
    );

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled || menuOpen ? "bg-canvas/95 backdrop-blur shadow-sm border-b border-harbor/10" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4 gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0 shrink-0" onClick={() => setMenuOpen(false)}>
          <Image src="/logo.png" alt="رفقة" width={36} height={36} priority className="h-9 w-9 shrink-0 object-contain" />
          <span className="font-display text-lg sm:text-xl font-extrabold text-harbor whitespace-nowrap">
            رفقة <span className="hidden sm:inline text-rope font-normal text-sm">من مرسى</span>
          </span>
        </Link>

        {/* Desktop nav — unchanged, just now explicitly md+ only */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-harbor shrink-0">
          <Link href="/#pricing" className="hover:text-brass transition-colors">
            الأسعار
          </Link>
          <Link href="/#features" className="hover:text-brass transition-colors">
            المزايا
          </Link>
          <ThemeToggle className="text-lg hover:opacity-70 transition-opacity" />
          {authLinks}
        </nav>

        {/* Mobile: theme toggle + hamburger only, in the row */}
        <div className="flex md:hidden items-center gap-1 shrink-0">
          <ThemeToggle className="text-lg hover:opacity-70 transition-opacity p-1.5" />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={menuOpen}
            className="p-2 -m-2 text-harbor"
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <nav className="md:hidden border-t border-harbor/10 bg-canvas px-4 py-4 flex flex-col gap-4 text-sm font-medium text-harbor">
          <Link href="/#pricing" className="hover:text-brass transition-colors" onClick={() => setMenuOpen(false)}>
            الأسعار
          </Link>
          <Link href="/#features" className="hover:text-brass transition-colors" onClick={() => setMenuOpen(false)}>
            المزايا
          </Link>
          <div className="flex flex-col gap-3 pt-1 border-t border-harbor/10" onClick={() => setMenuOpen(false)}>
            {authLinks}
          </div>
        </nav>
      )}
    </header>
  );
}
