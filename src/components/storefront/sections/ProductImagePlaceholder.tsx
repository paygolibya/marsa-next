// Shared "no image yet" state for product/bundle cards across every
// template — previously just plain muted text, which reads as a bug at a
// glance rather than a deliberate empty state. A lot of new merchants list
// their first products before taking real photos, so this is a common,
// not edge-case, path.
export function ProductImagePlaceholder({ label, tone = "light" }: { label: string; tone?: "light" | "dark" }) {
  const toneClasses =
    tone === "dark" ? "bg-white/5 text-white/40" : "bg-gradient-to-br from-harbor/5 to-harbor/10 text-rope";
  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1.5 ${toneClasses}`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}
