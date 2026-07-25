"use client";

import Link from "next/link";
import { formatLYD } from "@/lib/api";
import type { CartLine } from "@/lib/use-cart";

export function CartDrawer({
  open,
  onClose,
  storeSlug,
  lines,
  subtotalCents,
  setQuantity,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
  lines: CartLine[];
  subtotalCents: number;
  setQuantity: (productId: string, quantity: number) => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-harbor/40 z-40" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-full max-w-sm bg-canvas shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-harbor/10 px-6 py-5">
          <h2 className="font-display text-xl font-bold text-harbor">سلة التسوق</h2>
          <button onClick={onClose} className="text-rope hover:text-harbor" aria-label="إغلاق السلة">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {lines.length === 0 && <p className="text-rope text-sm py-10 text-center">سلتك فارغة حاليًا.</p>}
          {lines.map((line) => (
            <div key={line.productId} className="flex items-center justify-between gap-3 border-b border-harbor/5 pb-4">
              <div className="flex-1">
                <p className="font-bold text-harbor text-sm">{line.name}</p>
                <p className="text-rope text-sm">{formatLYD(line.priceCents)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(line.productId, line.quantity - 1)}
                  className="h-7 w-7 rounded-full border border-harbor/20 text-harbor hover:bg-harbor/5"
                  aria-label="إنقاص الكمية"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm">{line.quantity}</span>
                <button
                  onClick={() => setQuantity(line.productId, line.quantity + 1)}
                  className="h-7 w-7 rounded-full border border-harbor/20 text-harbor hover:bg-harbor/5"
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
            className={`block text-center rounded-full py-3 font-bold transition-colors ${
              lines.length === 0
                ? "pointer-events-none bg-harbor/20 text-harbor/40"
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
