import { translate, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, newsletterSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

export function NewsletterSection({
  variant,
  colors,
  settings: rawSettings,
  store,
  newsletterEmail,
  setNewsletterEmail,
  newsletterState,
  onNewsletterSubmit,
}: SectionRenderProps) {
  const settings = safeParseSettings(newsletterSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  const heading = settings.heading;
  const body = settings.body || t("newsletter.bodyDefault", { storeName: store.name });

  if (variant === "bold") {
    return (
      <div className="rounded-3xl p-10 text-center max-w-xl mx-auto text-white shadow-2xl" style={{ backgroundColor: colors.primary }}>
        <h3 className="font-display text-2xl font-extrabold mb-2">{heading || t("newsletter.headingBold")}</h3>
        <p className="opacity-90 mb-5">{settings.body || t("newsletter.bodyBold", { storeName: store.name })}</p>
        {newsletterState === "done" ? (
          <p className="font-bold">{t("newsletter.success")}</p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 rounded-xl px-4 py-3 text-harbor font-bold"
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              className="rounded-xl bg-white px-6 py-3 font-extrabold disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ color: colors.primary }}
            >
              {newsletterState === "loading" ? "..." : t("newsletter.subscribe")}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-sm mt-2 opacity-90">{t("newsletter.error")}</p>}
      </div>
    );
  }

  if (variant === "luxury") {
    return (
      <div className="text-center max-w-md mx-auto">
        <h3 className="font-display font-bold mb-2 tracking-wide" style={{ color: colors.accent }}>
          {heading || t("newsletter.headingLuxury")}
        </h3>
        <p className="text-sm text-white/60 mb-5">{settings.body || t("newsletter.bodyLuxury", { storeName: store.name })}</p>
        {newsletterState === "done" ? (
          <p className="text-sm font-bold" style={{ color: colors.accent }}>
            {t("newsletter.success")}
          </p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="flex-1 rounded-none border-0 border-b bg-transparent px-2 py-2 text-white placeholder:text-white/40 focus:outline-none"
              style={{ borderColor: `${colors.accent}50` }}
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              className="rounded-full border px-6 py-2 text-xs font-bold tracking-widest disabled:opacity-50 hover:bg-white/5 transition-colors"
              style={{ borderColor: colors.accent, color: colors.accent }}
            >
              {newsletterState === "loading" ? "..." : t("newsletter.subscribe")}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-xs mt-2 text-white/50">{t("newsletter.error")}</p>}
      </div>
    );
  }

  if (variant === "marketplace") {
    return (
      <div className="rounded-lg border border-harbor/10 bg-white p-6 text-center max-w-md mx-auto">
        <h3 className="font-bold text-harbor mb-1 text-sm" style={{ color: colors.text }}>{heading || t("newsletter.headingDefault")}</h3>
        <p className="text-xs text-rope mb-3">{body}</p>
        {newsletterState === "done" ? (
          <p className="text-xs font-bold text-green-700">{t("newsletter.success")}</p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder={t("newsletter.placeholder")}
              className="input flex-1 !py-2 text-sm"
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              style={{ backgroundColor: colors.primary }}
              className="rounded-lg px-4 py-2 font-bold text-white text-xs disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {newsletterState === "loading" ? "..." : t("newsletter.subscribe")}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-signal text-xs mt-2">{t("newsletter.error")}</p>}
      </div>
    );
  }

  // modern
  return (
    <div className="rounded-2xl border border-dashed border-harbor/20 p-8 text-center max-w-lg mx-auto">
      <h3 className="font-display font-bold text-harbor mb-2" style={{ color: colors.text }}>{heading || t("newsletter.headingDefault")}</h3>
      <p className="text-sm text-rope mb-4">{body}</p>
      {newsletterState === "done" ? (
        <p className="text-sm font-bold text-green-700">{t("newsletter.success")}</p>
      ) : (
        <form onSubmit={onNewsletterSubmit} className="flex gap-2">
          <input
            type="email"
            required
            dir="ltr"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            placeholder={t("newsletter.placeholder")}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={newsletterState === "loading"}
            style={{ backgroundColor: colors.primary }}
            className="rounded-full px-6 py-2.5 font-bold text-white text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {newsletterState === "loading" ? "..." : t("newsletter.subscribe")}
          </button>
        </form>
      )}
      {newsletterState === "error" && <p className="text-signal text-xs mt-2">{t("newsletter.error")}</p>}
    </div>
  );
}
