"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/api";

export type CartLine = { productId: string; name: string; priceCents: number; quantity: number };

function storageKey(storeSlug: string) {
  return `marsa_cart_${storeSlug}`;
}

/**
 * Per-store shopping cart. Persisted to localStorage so it survives
 * navigation between the catalog page (/store/[slug]) and the checkout
 * page (/store/[slug]/checkout) — those are separate route trees, so a
 * hook + localStorage is simpler here than a context provider that would
 * need to wrap both.
 */
export function useCart(storeSlug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(storeSlug));
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // ignore corrupted cart
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug]);

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next);
      localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
    },
    [storeSlug]
  );

  const add = useCallback(
    (product: Product, quantity = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.productId === product.id);
        const next = existing
          ? prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l))
          : [...prev, { productId: product.id, name: product.name, priceCents: product.priceCents, quantity }];
        localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
        return next;
      });
    },
    [storeSlug]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      setLines((prev) => {
        const next =
          quantity <= 0
            ? prev.filter((l) => l.productId !== productId)
            : prev.map((l) => (l.productId === productId ? { ...l, quantity } : l));
        localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
        return next;
      });
    },
    [storeSlug]
  );

  const remove = useCallback((productId: string) => setQuantity(productId, 0), [setQuantity]);

  const clear = useCallback(() => persist([]), [persist]);

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  return { lines, ready, add, remove, setQuantity, clear, subtotalCents, totalItems };
}
