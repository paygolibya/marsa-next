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
  const heading = settings.heading;
  const body = settings.body || `عروض ومنتجات جديدة من ${store.name}`;

  if (variant === "bold") {
    return (
      <div className="rounded-3xl p-10 text-center max-w-xl mx-auto text-white shadow-2xl" style={{ backgroundColor: colors.primary }}>
        <h3 className="font-display text-2xl font-extrabold mb-2">{heading || "لا تفوّت عروضنا القادمة"}</h3>
        <p className="opacity-90 mb-5">{settings.body || `اشترك واحصل على آخر الأخبار من ${store.name}`}</p>
        {newsletterState === "done" ? (
          <p className="font-bold">✓ تم الاشتراك بنجاح</p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 rounded-xl px-4 py-3 text-harbor font-bold"
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              className="rounded-xl bg-white px-6 py-3 font-extrabold disabled:opacity-60 hover:opacity-90 transition-opacity"
              style={{ color: colors.primary }}
            >
              {newsletterState === "loading" ? "..." : "اشترك"}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-sm mt-2 opacity-90">تعذّر الاشتراك، حاول مجددًا</p>}
      </div>
    );
  }

  if (variant === "luxury") {
    return (
      <div className="text-center max-w-md mx-auto">
        <h3 className="font-display font-bold mb-2 tracking-wide" style={{ color: colors.accent }}>
          {heading || "انضم إلى قائمتنا الخاصة"}
        </h3>
        <p className="text-sm text-white/60 mb-5">{settings.body || `عروض حصرية من ${store.name}`}</p>
        {newsletterState === "done" ? (
          <p className="text-sm font-bold" style={{ color: colors.accent }}>
            ✓ تم الاشتراك بنجاح
          </p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="flex-1 rounded-none border-0 border-b bg-transparent px-2 py-2 text-white placeholder:text-white/40 focus:outline-none"
              style={{ borderColor: `${colors.accent}50` }}
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              className="rounded-full border px-6 py-2 text-xs font-bold tracking-widest disabled:opacity-50 hover:bg-white/5 transition-colors"
              style={{ borderColor: colors.accent, color: colors.accent }}
            >
              {newsletterState === "loading" ? "..." : "اشترك"}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-xs mt-2 text-white/50">تعذّر الاشتراك، حاول مجددًا</p>}
      </div>
    );
  }

  if (variant === "marketplace") {
    return (
      <div className="rounded-lg border border-harbor/10 bg-white p-6 text-center max-w-md mx-auto">
        <h3 className="font-bold text-harbor mb-1 text-sm">{heading || "اشترك ليصلك كل جديد"}</h3>
        <p className="text-xs text-rope mb-3">{body}</p>
        {newsletterState === "done" ? (
          <p className="text-xs font-bold text-green-700">✓ تم الاشتراك بنجاح</p>
        ) : (
          <form onSubmit={onNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              required
              dir="ltr"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="بريدك الإلكتروني"
              className="input flex-1 !py-2 text-sm"
            />
            <button
              type="submit"
              disabled={newsletterState === "loading"}
              style={{ backgroundColor: colors.primary }}
              className="rounded-lg px-4 py-2 font-bold text-white text-xs disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {newsletterState === "loading" ? "..." : "اشترك"}
            </button>
          </form>
        )}
        {newsletterState === "error" && <p className="text-signal text-xs mt-2">تعذّر الاشتراك، حاول مجددًا</p>}
      </div>
    );
  }

  // modern
  return (
    <div className="rounded-2xl border border-dashed border-harbor/20 p-8 text-center max-w-lg mx-auto">
      <h3 className="font-display font-bold text-harbor mb-2">{heading || "اشترك ليصلك كل جديد"}</h3>
      <p className="text-sm text-rope mb-4">{body}</p>
      {newsletterState === "done" ? (
        <p className="text-sm font-bold text-green-700">✓ تم الاشتراك بنجاح</p>
      ) : (
        <form onSubmit={onNewsletterSubmit} className="flex gap-2">
          <input
            type="email"
            required
            dir="ltr"
            value={newsletterEmail}
            onChange={(e) => setNewsletterEmail(e.target.value)}
            placeholder="بريدك الإلكتروني"
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={newsletterState === "loading"}
            style={{ backgroundColor: colors.primary }}
            className="rounded-full px-6 py-2.5 font-bold text-white text-sm disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {newsletterState === "loading" ? "..." : "اشترك"}
          </button>
        </form>
      )}
      {newsletterState === "error" && <p className="text-signal text-xs mt-2">تعذّر الاشتراك، حاول مجددًا</p>}
    </div>
  );
}
