import type { Metadata } from "next";
import { Almarai } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme-context";
import ChatWidget from "@/components/layout/ChatWidget";

// One Arabic font (Almarai) for the whole site now, loaded into both CSS
// variable slots tailwind.config.ts already expects (font-display and
// font-body) — previously Cairo (display) + Tajawal (body). Two separate
// next/font instances because each needs its own `variable` name; Almarai
// doesn't have a 600 or 500 weight, so those drop out of the requested sets.
const almaraiDisplay = Almarai({
  subsets: ["arabic"],
  weight: ["700", "800"],
  variable: "--font-cairo",
});

const almaraiBody = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "رفقة — من مرسى",
  description: "منصة رفقة للتجارة الإلكترونية في ليبيا، من مرسى",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${almaraiDisplay.variable} ${almaraiBody.variable}`} suppressHydrationWarning>
      <head>
        {/* Must run before hydration — sets .dark on <html> synchronously
            so the first paint already has the right theme, matching the
            stored preference (or the OS's) instead of flashing light mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <ChatWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}
