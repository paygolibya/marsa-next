"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Next.js's root error boundary — catches a rendering error that escapes
// every nested error.tsx, meaning the normal <html>/<body> from the root
// layout is already gone, so this has to render its own from scratch.
// Reports to Sentry (a genuine error users hit deserves to be seen, not
// just logged to a console nobody's watching) — no-ops safely if
// SENTRY_DSN isn't configured, same as every other integration here.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.5rem" }}>حدث خطأ غير متوقع</h1>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>نعتذر عن الإزعاج — تم تسجيل المشكلة تلقائيًا.</p>
          <button
            onClick={() => reset()}
            style={{ borderRadius: "999px", padding: "0.75rem 2rem", fontWeight: 700, background: "#0E2A3F", color: "white", border: "none", cursor: "pointer" }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
