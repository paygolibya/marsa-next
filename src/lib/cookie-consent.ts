// Shared localStorage-backed cookie consent state (not a cookie itself —
// consistent with how auth/cart already use localStorage, not cookies, see
// src/lib/auth-context.tsx's STORAGE_KEY convention). A custom window event
// lets ChatWidget react immediately if consent changes while it's mounted,
// without needing a page reload.
const STORAGE_KEY = "marsa_cookie_consent";
const CONSENT_EVENT = "marsa-cookie-consent-changed";

export type ConsentChoice = "accepted" | "declined";

export function getCookieConsent(): ConsentChoice | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  } catch {
    // Private browsing / storage blocked — the banner just won't persist
    // across reloads, not worth failing anything over.
  }
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === "accepted";
}

export function onCookieConsentChange(handler: (choice: ConsentChoice) => void): () => void {
  function listener(e: Event) {
    handler((e as CustomEvent<ConsentChoice>).detail);
  }
  window.addEventListener(CONSENT_EVENT, listener);
  return () => window.removeEventListener(CONSENT_EVENT, listener);
}
