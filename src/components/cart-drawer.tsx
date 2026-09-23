"use client";

import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { CartLine } from "@/lib/use-cart";

// Optional — when the calling page has the store's own customization
// loaded, the drawer picks up the MERCHANT's colors instead of always
// looking like Rifqa's own generic UI. Falls back to the platform's
// canvas/harbor/signal tokens when a store has no customization yet
// (or the call site hasn't fetched it), so nothing breaks for existing
// callers.
export type CartDrawerTheme = {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
};

export function CartDrawer({
  open,
  onClose,
  storeSlug,
  lines,
  subtotalCents,
  setQuantity,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
  lines: CartLine[];
  subtotalCents: number;
  setQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  theme?: CartDrawerTheme;
}) {
  const primary = theme?.primaryColor || undefined;
  const secondary = theme?.secondaryColor || undefined;
  const accent = theme?.accentColor || primary;

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} aria-hidden />}
      <aside
        style={secondary ? { backgroundColor: secondary } : undefined}
        className={`fixed top-0 bottom-0 right-0 z-50 w-full max-w-sm shadow-2xl transition-transform duration-300 flex flex-col ${
          secondary ? "" : "bg-canvas"
        } ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div
          style={primary ? { backgroundColor: primary } : undefined}
          className={`flex items-center justify-between px-6 py-5 ${primary ? "" : "border-b border-harbor/10"}`}
        >
          <h2 className={`font-display text-xl font-bold ${primary ? "text-white" : "text-harbor"}`}>سلة التسوق</h2>
          <button
            onClick={onClose}
            className={primary ? "text-white/80 hover:text-white" : "text-rope hover:text-harbor"}
            aria-label="إغلاق السلة"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {lines.length === 0 && <p className="text-rope text-sm py-10 text-center">سلتك فارغة حاليًا.</p>}
          {lines.map((line) => (
            <div key={`${line.productId}:${line.variantId ?? ""}`} className="flex items-center justify-between gap-3 border-b border-harbor/10 pb-4">
              <div className="flex-1">
                <p className="font-bold text-harbor text-sm">{line.name}</p>
                {line.variantLabel && <p className="text-xs text-rope">{line.variantLabel}</p>}
                <p className="text-rope text-sm">{formatLYD(line.priceCents)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(line.productId, line.quantity - 1, line.variantId)}
                  style={accent ? { borderColor: `${accent}80`, color: accent } : undefined}
                  className={`h-7 w-7 rounded-full border ${accent ? "hover:bg-black/5" : "border-harbor/20 text-harbor hover:bg-harbor/5"}`}
                  aria-label="إنقاص الكمية"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm text-harbor">{line.quantity}</span>
                <button
                  onClick={() => setQuantity(line.productId, line.quantity + 1, line.variantId)}
                  style={accent ? { borderColor: `${accent}80`, color: accent } : undefined}
                  className={`h-7 w-7 rounded-full border ${accent ? "hover:bg-black/5" : "border-harbor/20 text-harbor hover:bg-harbor/5"}`}
                  aria-label="زيادة الكمية"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-harbor/10 px-6 py-5 space-y-4">
          <div className="flex items-center justify-between font-bold text-harbor">
            <span>الإجمالي</span>
            <span>{formatLYD(subtotalCents)}</span>
          </div>
          <Link
            href={`/store/${storeSlug}/checkout`}
            style={lines.length > 0 && accent ? { backgroundColor: accent } : undefined}
            className={`block text-center rounded-full py-3 font-bold transition-colors ${
              lines.length === 0
                ? "pointer-events-none bg-harbor/20 text-harbor/40"
                : accent
                  ? "text-white hover:opacity-90"
                  : "bg-signal text-canvas hover:bg-signal-dark"
            }`}
          >
            إتمام الطلب
          </Link>
        </div>
      </aside>
    </>
  );
}
