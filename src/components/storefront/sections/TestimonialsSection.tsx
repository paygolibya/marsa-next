import { safeParseSettings, testimonialsSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

export function TestimonialsSection({ variant, colors, settings: rawSettings, testimonials }: SectionRenderProps) {
  const settings = safeParseSettings(testimonialsSettingsSchema, rawSettings);
  const items = testimonials.slice(0, settings.limit);
  if (items.length === 0) return null;

  if (variant === "bold") {
    return (
      <div>
        <h2 className="font-display text-2xl font-extrabold text-harbor mb-8 text-center">{settings.title || "ماذا يقول عملاؤنا"}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((t, i) => (
            <div key={i} className="rounded-2xl bg-white p-6 shadow-lg">
              <p className="text-lg mb-3" style={{ color: colors.accent }}>
                {"★".repeat(t.rating)}
                {"☆".repeat(5 - t.rating)}
              </p>
              {t.reviewText && <p className="text-harbor/80 mb-4">&quot;{t.reviewText}&quot;</p>}
              <p className="text-xs font-bold text-rope">
                {t.buyerName} — {t.productName}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "luxury") {
    return (
      <div className="text-center">
        <h2 className="font-display text-xl font-extrabold mb-10 tracking-wide" style={{ color: colors.accent }}>
          {settings.title || "آراء عملائنا"}
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {items.map((t, i) => (
            <div key={i}>
              <p className="mb-3" style={{ color: colors.accent }}>
                {"★".repeat(t.rating)}
                {"☆".repeat(5 - t.rating)}
              </p>
              {t.reviewText && <p className="text-sm text-white/70 mb-3">&quot;{t.reviewText}&quot;</p>}
              <p className="text-xs text-white/40 tracking-wide">
                {t.buyerName} — {t.productName}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "marketplace") {
    return (
      <div>
        <h2 className="font-display text-lg font-extrabold text-harbor mb-4">{settings.title || "آراء المشترين"}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((t, i) => (
            <div key={i} className="rounded-lg border border-harbor/10 bg-white p-3">
              <p className="text-xs mb-1" style={{ color: colors.accent }}>
                {"★".repeat(t.rating)}
                {"☆".repeat(5 - t.rating)}
              </p>
              {t.reviewText && <p className="text-xs text-harbor/80 mb-2 line-clamp-3">&quot;{t.reviewText}&quot;</p>}
              <p className="text-[10px] text-rope">
                {t.buyerName} — {t.productName}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // modern
  return (
    <div>
      <h2 className="font-display text-xl font-extrabold text-harbor mb-6">{settings.title || "آراء عملائنا"}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t, i) => (
          <div key={i} className="rounded-2xl border border-harbor/10 bg-white p-5">
            <p className="font-bold mb-2" style={{ color: colors.accent }}>
              {"★".repeat(t.rating)}
              {"☆".repeat(5 - t.rating)}
            </p>
            {t.reviewText && <p className="text-sm text-harbor/80 mb-3">&quot;{t.reviewText}&quot;</p>}
            <p className="text-xs text-rope">
              {t.buyerName} — {t.productName}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
