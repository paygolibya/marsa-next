"use client";

import { useEffect } from "react";

// Escape closes whatever overlay is open (drawer, dropdown, mobile menu).
// Backdrop clicks were the only way to close these before, which keyboard
// users can't do — the Modal component already handled Escape itself.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onEscape]);
}
