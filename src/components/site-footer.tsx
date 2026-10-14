import Image from "next/image";
import { translate, type Language } from "@/lib/i18n";

// The `store` prop is what makes footerStyle "branded" actually different
// from "standard" — previously this component took no props at all, so a
// merchant's own store footer was indistinguishable from Rifqa's own
// platform pages, regardless of what footerStyle was saved.
//
// `transparent` is a SEPARATE, Rifqa-only concern: this component is also
// used on merchant storefronts (store/[slug]/*), which must always keep
// their own solid dark footer regardless of what Rifqa's own marketing
// site looks like — so it defaults to false and only Rifqa's own pages
// (currently just the homepage) opt in explicitly.
type SocialLinks = { instagramUrl?: string | null; facebookUrl?: string | null; tiktokUrl?: string | null };

// Rifqa's OWN social accounts — separate from a merchant's own
// instagramUrl/facebookUrl/tiktokUrl (store.customization), which are that
// merchant's business links, not the platform's. Used on Rifqa's own
// marketing pages (homepage, cookies policy, ...), never on a merchant
// storefront.
export const RIFQA_SOCIAL_LINKS: SocialLinks = {
  facebookUrl: "https://www.facebook.com/share/1FxXb5eWMh/?mibextid=wwXIfr",
  instagramUrl: "https://instagram.com/rifqa.ly?dlrf=b2thM2t5NDZobWNs&utm_source=qr",
  tiktokUrl: "https://www.tiktok.com/@rifqa.ly",
};

// Minimal inline glyphs (no icon library in this codebase) — just enough
// to be recognizable at 20px, matching the footer's own understated style.
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 21v-7.5H16l.4-3H13.5V8.5c0-.9.25-1.5 1.6-1.5H16.5V4.3c-.3-.04-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6V10.5H8.5v3H10.9V21h2.6Z" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 3c.3 2 1.7 3.5 4 3.8v2.7c-1.4 0-2.8-.4-4-1.2v6.2c0 3.1-2.5 5.5-5.6 5.5S5.3 17.6 5.3 14.5c0-3 2.4-5.4 5.3-5.5v2.8a2.7 2.7 0 1 0 2.7 2.7V3h3.2Z" />
    </svg>
  );
}

// storeSlug name links out to the merchant's own profile, not Rifqa's —
// opens in a new tab since following it means leaving the storefront.
function SocialLinksRow({ links }: { links: SocialLinks }) {
  const items: { href: string; label: string; Icon: () => React.ReactElement }[] = [];
  if (links.instagramUrl) items.push({ href: links.instagramUrl, label: "Instagram", Icon: InstagramIcon });
  if (links.facebookUrl) items.push({ href: links.facebookUrl, label: "Facebook", Icon: FacebookIcon });
  if (links.tiktokUrl) items.push({ href: links.tiktokUrl, label: "TikTok", Icon: TikTokIcon });
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {items.map(({ href, label, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="opacity-80 hover:opacity-100 transition-opacity">
          <Icon />
        </a>
      ))}
    </div>
  );
}

export function SiteFooter({
  store,
  socialLinks,
  transparent = false,
  language = "ar",
}: {
  store?: { name: string; tagline?: string | null; logo?: string | null };
  socialLinks?: SocialLinks;
  transparent?: boolean;
  language?: Language;
} = {}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  return (
    <footer className={`border-t ${transparent ? "border-white/15 text-canvas/80" : "border-harbor/10 bg-harbor text-canvas/70"}`}>
      <div className="mx-auto max-w-6xl px-6 py-10">
        {store && (
          <div className="mb-6 pb-6 border-b border-canvas/10 text-center flex flex-col items-center gap-2">
            {store.logo && (
              // "branded" footerStyle promises the merchant's own logo, not
              // just their name — this <img> never existed before, so that
              // half of "يعرض اسم متجرك وشعارك" was silently never true.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.logo} alt={store.name} className="h-10 w-10 rounded-full object-cover" />
            )}
            <p className="font-display text-lg font-extrabold text-canvas">{store.name}</p>
            {store.tagline && <p className="text-sm mt-1">{store.tagline}</p>}
            {socialLinks && <div className="mt-2"><SocialLinksRow links={socialLinks} /></div>}
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            {/* logo.png is 720x836 (portrait, ~0.86:1) — forcing it into a
                square h-7 w-7 box let object-contain shrink it to fit the
                height, letterboxed with blank padding on both sides, so it
                rendered visibly smaller than its own box. width/height now
                match the real aspect ratio, same fix already applied to the
                Moamalat payment icon below. */}
            <Image src="/logo.png" alt={t("footer.alt")} width={24} height={28} className="h-7 w-auto object-contain" />
            <span>{t("footer.brand")}</span>
          </div>
          {/* Shown here (not just inside the branded block above) so a
              merchant on "standard" footerStyle — the default, not
              "branded" — still gets their social links, since those are
              the merchant's own business links, unrelated to whether the
              footer also shows their name/logo. */}
          {!store && socialLinks && <SocialLinksRow links={socialLinks} />}
          <p>{t("footer.madeIn", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
