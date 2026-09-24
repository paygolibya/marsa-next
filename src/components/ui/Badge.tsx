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

export function Badge({ tone = "neutral", className = "", ...rest }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`} {...rest} />;
}
