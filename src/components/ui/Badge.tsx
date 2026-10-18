export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

// bg-{hue}-100/text-{hue}-800 — deliberately the exact class names
// globals.css's dark-mode retrofit already overrides (see the "status
// pills" section there), so this gets correct dark-mode colors for free
// without adding new .dark rules.
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-harbor/10 text-harbor",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-harbor/60",
  success: "bg-green-600",
  warning: "bg-yellow-600",
  danger: "bg-red-600",
  info: "bg-blue-600",
};

// `dot` adds a status indicator (pattern from 21st.dev's "Status"
// component); `pulse` animates it for states that need the merchant's
// attention, and stays still under prefers-reduced-motion.
export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean; pulse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
      {...rest}
    >
      {dot && (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          {pulse && <span className={`absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping ${DOT_CLASSES[tone]}`} />}
          <span className={`relative h-2 w-2 rounded-full ${DOT_CLASSES[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}
