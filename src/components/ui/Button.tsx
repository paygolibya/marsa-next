"use client";

import { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

// Each variant has distinct hover / pressed / disabled states (not just a
// color swap on hover), and every size clears the 40-44px minimum touch
// target — merchants run their store from a phone as often as a laptop.
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-signal text-white shadow-sm shadow-signal/25 hover:bg-signal-dark hover:shadow-md hover:shadow-signal/30",
  secondary: "border border-harbor/20 bg-white/60 text-harbor hover:bg-harbor/5 hover:border-harbor/30",
  ghost: "text-rope hover:text-harbor hover:bg-harbor/5",
  danger: "text-signal hover:bg-signal/10",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[40px] rounded-full px-4 text-sm",
  md: "min-h-[44px] rounded-full px-6",
  lg: "min-h-[52px] rounded-full px-8 text-lg",
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
}>(function Button({ variant = "primary", size = "md", loading, loadingText, className = "", children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 font-bold cursor-pointer select-none transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
});
