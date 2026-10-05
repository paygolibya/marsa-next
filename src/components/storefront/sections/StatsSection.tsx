import { translate, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, statsSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

// Not rendered at all by MarketplaceTemplate (it shows social proof inline
// in its sticky header instead) — that template simply omits "stats" from
// its section-type map, so this component is never reached for it.
export function StatsSection({ variant, colors, stats, settings: rawSettings, store }: SectionRenderProps) {
  const settings = safeParseSettings(statsSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  if (!stats || (stats.deliveredOrderCount <= 0 && stats.reviewCount <= 0)) return null;
  const showRating = settings.showRating && stats.averageRating != null && stats.reviewCount > 0;
  if (stats.deliveredOrderCount <= 0 && !showRating) return null;

  if (variant === "bold") {
    return (
      <div className="rounded-3xl bg-harbor text-white py-6 px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 text-center">
          {stats.deliveredOrderCount > 0 && (
            <div>
              <p className="font-display text-2xl font-extrabold">+{stats.deliveredOrderCount}</p>
              <p className="text-xs opacity-70">{t("stats.deliveredLabel")}</p>
            </div>
          )}
          {showRating && (
            <div>
              <p className="font-display text-2xl font-extrabold">★ {stats.averageRating!.toFixed(1)}</p>
              <p className="text-xs opacity-70">{t("stats.reviewsSuffix", { count: stats.reviewCount })}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === "luxury") {
    return (
      <div className="flex flex-wrap justify-center gap-8 text-center">
        {stats.deliveredOrderCount > 0 && (
          <div>
            <p className="font-display text-xl font-extrabold" style={{ color: colors.accent }}>
              +{stats.deliveredOrderCount}
            </p>
            <p className="text-xs text-white/50 tracking-wide">{t("stats.deliveredLabel")}</p>
          </div>
        )}
        {showRating && (
          <div>
            <p className="font-display text-xl font-extrabold" style={{ color: colors.accent }}>
              ★ {stats.averageRating!.toFixed(1)}
            </p>
            <p className="text-xs text-white/50 tracking-wide">{t("stats.reviewsSuffix", { count: stats.reviewCount })}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {stats.deliveredOrderCount > 0 && (
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold border border-harbor/10" style={{ color: colors.accent }}>
          {t("stats.deliveredCombined", { count: stats.deliveredOrderCount })}
        </span>
      )}
      {showRating && (
        <span className="rounded-full bg-white px-4 py-1.5 text-sm font-bold border border-harbor/10" style={{ color: colors.accent }}>
          {t("stats.ratingWithCount", { rating: stats.averageRating!.toFixed(1), count: stats.reviewCount })}
        </span>
      )}
    </div>
  );
}
