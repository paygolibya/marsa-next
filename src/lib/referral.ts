"use client";

// An affiliate's shared link carries ?ref=CODE on whatever storefront page
// a buyer first lands on (home, a product, a bundle) — not necessarily
// checkout itself, which is where the order actually gets created. This
// persists the code to localStorage (same per-store-slug key pattern as
// useCart) so it survives browsing between pages until checkout reads it
// back via getReferralCode. An unrecognized/inactive code is validated
// (and silently ignored if invalid) server-side at order creation, never
// here — this is pure capture/storage, no validation.
const PREFIX = "marsa_ref_";

export function captureReferralCode(storeSlug: string) {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem(`${PREFIX}${storeSlug}`, ref);
  } catch {
    // Private browsing / blocked storage — the buyer just won't be
    // attributed to an affiliate, not worth failing anything over.
  }
}

export function getReferralCode(storeSlug: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${storeSlug}`);
  } catch {
    return null;
  }
}
