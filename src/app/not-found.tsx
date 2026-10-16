import Link from "next/link";
import Image from "next/image";

// Root 404 — previously Next's default English "This page could not be
// found." on an otherwise all-Arabic site. Also what a storefront shows
// for a missing product/page, so the copy and the "/" link stay neutral:
// on {slug}.rifqa.ly, "/" is that store's own home page, not rifqa.ly.
export default function NotFound() {
  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center animate-rise-in">
        <div className="relative mx-auto mb-8 h-28 w-28">
          <div className="absolute inset-0 rounded-full bg-signal/10 animate-pulse" aria-hidden />
          <Image src="/logo.png" alt="" width={112} height={112} className="relative h-28 w-28 object-contain p-4" priority />
        </div>
        <p className="font-display text-6xl font-extrabold text-signal mb-3" dir="ltr">
          404
        </p>
        <h1 className="font-display text-2xl font-extrabold text-ink mb-2">الصفحة غير موجودة</h1>
        <p className="text-ink/60 mb-8 leading-relaxed">ربما تم نقل هذه الصفحة أو حذفها، أو أن الرابط غير صحيح.</p>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-harbor px-8 font-bold text-white transition hover:bg-harbor-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
