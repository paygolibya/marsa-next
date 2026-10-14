"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

// Dependency-free (portal + Escape + backdrop click + a basic Tab focus
// trap) — matches this codebase's pattern of not reaching for a UI library
// for simple needs (see TemplateCustomizer's own hand-rolled drag-and-drop).
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleTabTrap(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Blur signals "the page behind is paused until you finish or
          dismiss this", not decoration. */}
      <div className="absolute inset-0 bg-harbor-deep/50 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleTabTrap}
        className="relative w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl p-6 outline-none animate-modal-in"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          {title ? <h2 className="font-display text-lg font-extrabold text-harbor">{title}</h2> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rope hover:bg-harbor/5 hover:text-harbor transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 pt-4 border-t border-harbor/10 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
