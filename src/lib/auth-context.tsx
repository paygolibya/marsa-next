"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    if (!token) return;
    try {
      const { merchant: fresh } = await api.me(token);
      setMerchant(fresh);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, merchant: fresh }));
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
