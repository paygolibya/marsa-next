import type { Metadata } from "next";
import { Cairo, Tajawal } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import ChatWidget from "@/components/layout/ChatWidget";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["600", "700", "800"],
  variable: "--font-cairo",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "رفقة — من مرسى",
  description: "منصة رفقة للتجارة الإلكترونية في ليبيا، من مرسى",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${tajawal.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <ChatWidget />
      </body>
    </html>
  );
}
