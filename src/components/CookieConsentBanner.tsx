"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCookieConsent, setCookieConsent, type ConsentChoice } from "@/lib/cookie-consent";

const COPY = {
  ar: {
    message:
      "نستخدم تخزينًا محليًا على جهازك لتشغيل تسجيل الدخول والسلة — وليس ملفات تعريف ارتباط للتتبع. محادثة الدعم المباشر، إن فُعّلت، تضع ملفات تعريف ارتباط خاصة بها.",
    accept: "قبول",
    decline: "رفض",
    policy: "سياسة ملفات تعريف الارتباط",
  },
  en: {
    message:
      "We use local storage on your device to run login and your cart — not tracking cookies. Live chat support, if enabled, sets its own cookies.",
    accept: "Accept",
    decline: "Decline",
    policy: "Cookie policy",
  },
} as const;

// Mounted once in the root layout — covers the marketing site, dashboard,
// and every storefront. Reads document.documentElement.lang at mount time
// (storefronts set this themselves via src/lib/i18n/useTranslation.ts
// before this component's own effect runs, since it's rendered after
// {children} in layout.tsx) so the banner matches whatever language the
// page is already in, without needing the full i18n dictionary.
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    setLang(document.documentElement.lang === "en" ? "en" : "ar");
    setVisible(getCookieConsent() === null);
  }, []);

  if (!visible) return null;

  const t = COPY[lang];
  const dir = lang === "en" ? "ltr" : "rtl";

  function choose(choice: ConsentChoice) {
    setCookieConsent(choice);
    setVisible(false);
  }

  return (
    // z-30 — deliberately BELOW every interactive overlay in the app
    // (cart-drawer.tsx's backdrop/panel at z-40/z-50, SupportChatWidget at
    // z-40, the shared dashboard Modal at z-[60], ToastProvider at z-[80]):
    // confirmed live that a higher z-index here lets this full-width bottom
    // bar intercept clicks on the cart drawer's own checkout button,
    // breaking checkout for any visitor who hasn't yet dismissed it. Still
    // above ordinary page content.
    <div dir={dir} className="fixed inset-x-0 bottom-0 z-30 bg-harbor text-canvas px-4 py-4 sm:px-6 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex max-w-4xl flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <p className="text-sm flex-1 text-canvas/90">
          {t.message}{" "}
          <Link href="/cookies" className="underline hover:text-brass transition-colors">
            {t.policy}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose("declined")}
            className="rounded-full border border-canvas/30 px-4 py-2 text-sm font-bold hover:bg-canvas/10 transition-colors"
          >
            {t.decline}
          </button>
          <button
            onClick={() => choose("accepted")}
            className="rounded-full bg-signal px-4 py-2 text-sm font-bold text-canvas hover:bg-signal-dark transition-colors"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
