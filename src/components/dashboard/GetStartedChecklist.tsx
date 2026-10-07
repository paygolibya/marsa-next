"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/lib/api";
import { resolveChecklistSteps } from "@/lib/onboarding-checklist";
import { useToast } from "@/components/ui";

function dismissedKey(storeId: string) {
  return `marsa_onboarding_dismissed_${storeId}`;
}

export function GetStartedChecklist({ store, productCount }: { store: Store; productCount: number }) {
  const [dismissed, setDismissed] = useState(true); // starts hidden; localStorage read is client-only
  const toast = useToast();

  useEffect(() => {
    setDismissed(localStorage.getItem(dismissedKey(store.id)) === "1");
  }, [store.id]);

  const steps = resolveChecklistSteps(store, productCount);
  const completable = steps.filter((s) => s.done !== undefined);
  const doneCount = completable.filter((s) => s.done).length;
  const allDone = completable.length > 0 && doneCount === completable.length;

  if (dismissed || allDone) return null;

  function dismiss() {
    localStorage.setItem(dismissedKey(store.id), "1");
    setDismissed(true);
  }

  function handleShareClick(e: React.MouseEvent, href: string) {
    e.preventDefault();
    navigator.clipboard.writeText(href);
    toast.show("تم نسخ الرابط!");
  }

  return (
    <details open className="rounded-2xl border border-harbor/10 bg-white shadow-sm px-4 py-3 sm:px-6 sm:py-4 mb-8">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="font-display text-lg font-extrabold text-harbor">ابدأ الآن</span>
          <p className="text-xs text-rope mt-0.5">
            {doneCount} من {completable.length} خطوات مكتملة
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            dismiss();
          }}
          aria-label="إغلاق"
          className="shrink-0 text-rope hover:text-harbor text-lg leading-none px-1"
        >
          ✕
        </button>
      </summary>

      <div className="mt-2 h-1.5 w-full rounded-full bg-harbor/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-signal transition-all"
          style={{ width: completable.length > 0 ? `${(doneCount / completable.length) * 100}%` : "0%" }}
        />
      </div>

      <ul className="mt-4 space-y-3">
        {steps.map((step) => (
          <li key={step.id} className="flex items-center justify-between gap-3 rounded-xl border border-harbor/10 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  step.done ? "border-signal bg-signal text-canvas" : "border-harbor/20 text-transparent"
                }`}
              >
                ✓
              </span>
              <div className="min-w-0">
                <p className="font-bold text-harbor text-sm truncate">{step.title}</p>
                <p className="text-xs text-rope mt-0.5">{step.description}</p>
              </div>
            </div>
            {step.id === "share-link" ? (
              <button
                type="button"
                onClick={(e) => handleShareClick(e, step.ctaHref)}
                className="shrink-0 rounded-full border border-harbor/15 px-4 py-1.5 text-xs font-bold text-harbor hover:bg-harbor/5 transition-colors"
              >
                {step.ctaLabel}
              </button>
            ) : (
              !step.done && (
                <a
                  href={step.ctaHref}
                  className="shrink-0 rounded-full bg-signal px-4 py-1.5 text-xs font-bold text-canvas hover:bg-signal-dark transition-colors"
                >
                  {step.ctaLabel}
                </a>
              )
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
