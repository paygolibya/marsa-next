"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/api";

// variantId identifies the line alongside productId — two different
// variants of the same product (e.g. "Red/M" and "Blue/L") are genuinely
// different lines, not one merged quantity. null means "no variant" (a
// plain product, or a variant-less line from before this existed).
export type CartLine = { productId: string; variantId: string | null; name: string; variantLabel: string | null; priceCents: number; quantity: number };

function storageKey(storeSlug: string) {
  return `marsa_cart_${storeSlug}`;
}

function sameLine(l: CartLine, productId: string, variantId: string | null) {
  return l.productId === productId && (l.variantId ?? null) === (variantId ?? null);
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
      // Older carts (persisted before variants existed) have no
      // variantId/variantLabel field at all — normalize to null so
      // sameLine()'s comparisons behave consistently either way.
      type StoredLine = Partial<Pick<CartLine, "variantId" | "variantLabel">> & Omit<CartLine, "variantId" | "variantLabel">;
      if (raw) setLines((JSON.parse(raw) as StoredLine[]).map((l) => ({ variantId: null, variantLabel: null, ...l })));
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
    (product: Product, quantity = 1, variant?: { id: string; label: string; priceCents: number } | null) => {
      const variantId = variant?.id ?? null;
      setLines((prev) => {
        const existing = prev.find((l) => sameLine(l, product.id, variantId));
        const next = existing
          ? prev.map((l) => (sameLine(l, product.id, variantId) ? { ...l, quantity: l.quantity + quantity } : l))
          : [
              ...prev,
              {
                productId: product.id,
                variantId,
                variantLabel: variant?.label ?? null,
                name: product.name,
                priceCents: variant?.priceCents ?? product.priceCents,
                quantity,
              },
            ];
        localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
        return next;
      });
    },
    [storeSlug]
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number, variantId: string | null = null) => {
      setLines((prev) => {
        const next = quantity <= 0 ? prev.filter((l) => !sameLine(l, productId, variantId)) : prev.map((l) => (sameLine(l, productId, variantId) ? { ...l, quantity } : l));
        localStorage.setItem(storageKey(storeSlug), JSON.stringify(next));
        return next;
      });
    },
    [storeSlug]
  );

  const remove = useCallback((productId: string, variantId: string | null = null) => setQuantity(productId, 0, variantId), [setQuantity]);

  const clear = useCallback(() => persist([]), [persist]);

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  return { lines, ready, add, remove, setQuantity, clear, subtotalCents, totalItems };
}
