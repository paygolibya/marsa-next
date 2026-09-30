"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { api, type Merchant } from "@/lib/api";

type AuthState = {
  token: string | null;
  merchant: Merchant | null;
  ready: boolean; // true once localStorage has been read on mount
  login: (token: string, merchant: Merchant) => void;
  logout: () => void;
  refreshMerchant: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "marsa_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [ready, setReady] = useState(false);
  // Always holds the CURRENT token, read inside refreshMerchant's async
  // callback instead of the token it closed over — without this, a slow
  // /api/auth/me call started under one token (e.g. the moment an
  // impersonation session begins) can resolve AFTER login() has since
  // switched to a different token (e.g. exiting back to the admin's own
  // session) and clobber the newer, correct state with stale data. Found
  // by testing that exact exit-impersonation sequence live — login() was
  // previously the only caller that ever changed tokens, always once per
  // page load, so this race had no way to manifest before.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token);
        setMerchant(parsed.merchant);
      }
    } catch {
      // corrupted storage — ignore, user just needs to log in again
    }
    setReady(true);
  }, []);

  function login(newToken: string, newMerchant: Merchant) {
    setToken(newToken);
    setMerchant(newMerchant);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, merchant: newMerchant }));
  }

  function logout() {
    setToken(null);
    setMerchant(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // Re-fetches the merchant record from the server, e.g. to pick up an
  // admin's approval/rejection without requiring the merchant to log out
  // and back in.
  async function refreshMerchant() {
    const requestToken = token;
    if (!requestToken) return;
    try {
      const { merchant: fresh } = await api.me(requestToken);
      // The active token may have changed while this request was in
      // flight (see tokenRef's comment above) — a response for a token
      // that's no longer current is stale and must be discarded, not
      // applied on top of whatever's active now.
      if (tokenRef.current !== requestToken) return;
      setMerchant(fresh);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: requestToken, merchant: fresh }));
    } catch {
      // network hiccup or expired token — leave the cached merchant as-is
    }
  }

  useEffect(() => {
    if (ready && token) void refreshMerchant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  return (
    <AuthContext.Provider value={{ token, merchant, ready, login, logout, refreshMerchant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
