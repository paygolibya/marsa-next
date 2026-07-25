"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function SiteNav() {
  const { merchant, ready } = useAuth();

  return (
    <header className="border-b border-harbor/10 bg-canvas/95 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="stamp h-9 w-9 border-brass text-brass text-xs font-bold">م</span>
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
          {ready && merchant ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-harbor px-5 py-2 text-canvas hover:bg-harbor-deep transition-colors"
            >
              لوحة التحكم
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
