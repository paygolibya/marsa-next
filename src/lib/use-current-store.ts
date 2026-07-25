"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, type Store } from "@/lib/api";

const SELECTED_KEY = "marsa_selected_store";

/**
 * Loads all of the merchant's stores and tracks which one is "selected" for
 * the dashboard. Selection persists in localStorage (not a query param) so
 * every dashboard sub-page picks it up without needing to thread it through
 * every Link.
 */
export function useCurrentStore() {
  const { token, ready } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .myStores(token)
      .then((list) => {
        setStores(list);
        const stored = localStorage.getItem(SELECTED_KEY);
        const valid = stored && list.some((s) => s.id === stored);
        setSelectedId(valid ? stored : list[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, [ready, token]);

  const selectStore = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
  }, []);

  const store = stores.find((s) => s.id === selectedId) ?? null;

  return { stores, store, selectStore, loading, ready };
}
