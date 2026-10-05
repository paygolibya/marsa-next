import Image from "next/image";
import Link from "next/link";
import { formatLYD } from "@/lib/api";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, bundlesSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

// One shared card-grid design across all 4 template variants — same
// tradeoff CategoriesSection already makes (a filter control there, a
// showcase grid here), rather than 4 bespoke per-variant layouts like
// ProductsSection has. Colors are still pulled from the section's own
// theme props so it doesn't look generic against the merchant's actual
// template colors.
export function BundlesSection({ colors, store, bundles, onAddBundleToCart, settings: rawSettings }: SectionRenderProps) {
  const settings = safeParseSettings(bundlesSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
  if (bundles.length === 0) return null;

  return (
    <div className="mb-10">
      {settings.title ? (
        <h2 className="font-display text-xl font-extrabold mb-4" style={{ color: colors.text }}>
          {settings.title}
        </h2>
      ) : (
        <h2 className="font-display text-xl font-extrabold mb-4" style={{ color: colors.text }}>
          {t("bundles.heading")}
        </h2>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {bundles.map((bundle) => (
          <div key={bundle.id} className="rounded-2xl border border-harbor/10 bg-white overflow-hidden flex flex-col">
            <Link href={`/store/${store.slug}/bundle/${bundle.id}`} className="aspect-square bg-harbor/5 flex items-center justify-center text-rope text-sm">
              {bundle.imageUrl ? (
                <Image src={bundle.imageUrl} alt={bundle.name} width={800} height={800} unoptimized className="h-full w-full object-cover" />
              ) : (
                t("common.noImage")
              )}
            </Link>
            <div className="p-4 flex flex-col flex-1">
              <Link href={`/store/${store.slug}/bundle/${bundle.id}`} className="font-bold text-harbor hover:underline" style={{ color: colors.text }}>
                {bundle.name}
              </Link>
              <p className="text-xs text-rope mt-1">{t("bundles.itemsCount", { count: bundle.items.length })}</p>
              <p className="font-bold text-sm mt-1" style={{ color: colors.primary }}>
                {formatLYD(bundle.priceCents, language)}
              </p>
              <button
                onClick={() => onAddBundleToCart(bundle)}
                style={{ backgroundColor: colors.primary }}
                className="mt-4 rounded-full text-white py-2 font-bold text-sm hover:opacity-90 transition-opacity"
              >
                {t("bundles.addToCart")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
