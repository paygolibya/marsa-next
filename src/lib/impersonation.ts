"use client";

import type { Merchant } from "@/lib/api";

// Shared localStorage keys for the admin-impersonation flow — centralized
// here rather than duplicated between admin/merchants/page.tsx (where a
// session starts) and dashboard/layout.tsx (where it's shown/ended), so
// the two never drift on the shape.
const ADMIN_SESSION_KEY = "marsa_admin_session";
const IMPERSONATION_FLAG_KEY = "marsa_impersonation";
const SELECTED_STORE_KEY = "marsa_selected_store";

type ImpersonationFlag = {
  active: true;
  adminName: string;
  merchantName: string;
  startedAt: string;
};

// Called right before the admin's own session in "marsa_auth" gets
// overwritten with the impersonated merchant's — saves the admin's real
// {token, merchant} aside so exitImpersonation() can restore it exactly,
// and writes the flag the dashboard reads to show the banner and skip the
// phone-verification/subscription-status gates.
export function startImpersonation(admin: { token: string; merchant: Merchant }, impersonated: { merchant: Merchant }) {
  try {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
    const flag: ImpersonationFlag = {
      active: true,
      adminName: admin.merchant.name,
      merchantName: impersonated.merchant.name,
      startedAt: new Date().toISOString(),
    };
    localStorage.setItem(IMPERSONATION_FLAG_KEY, JSON.stringify(flag));
  } catch {
    // localStorage unavailable (private window, blocked storage) — the
    // impersonation token itself still works via marsa_auth; the admin
    // just won't see the banner or be able to "exit" cleanly, only log out.
  }
}

export function getImpersonationFlag(): ImpersonationFlag | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_FLAG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

// Restores the admin's own saved session and clears every impersonation
// key, including the selected-store id (it belongs to the impersonated
// merchant, not the admin — useCurrentStore would otherwise briefly hold
// a store id that isn't in the admin's own store list).
export function exitImpersonation(): { token: string; merchant: Merchant } | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    const restored = raw ? JSON.parse(raw) : null;
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(IMPERSONATION_FLAG_KEY);
    localStorage.removeItem(SELECTED_STORE_KEY);
    return restored;
  } catch {
    return null;
  }
}
