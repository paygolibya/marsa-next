import Image from "next/image";
import { translate, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, categoryShowcaseSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

// A visual "shop by category" grid — image-backed tiles, distinct from
// CategoriesSection's text pill filter row (which stays as a compact
// in-page filter control; this is a browsing/navigation block in its own
// right). One shared design across every template, same tradeoff
// CategoriesSection/BundlesSection/BestSellersSection already make.
// Clicking a tile sets the same selectedCategoryId the pill filter and
// ProductsSection already read — wherever the merchant places the
// products section relative to this one, selecting a tile filters it.
export function CategoryShowcaseSection({ colors, store, categories, setSelectedCategoryId, settings: rawSettings }: SectionRenderProps) {
  const settings = safeParseSettings(categoryShowcaseSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string) => translate(language, key);
  if (categories.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="font-display text-xl font-extrabold mb-4" style={{ color: colors.text }}>
        {settings.title || t("categoryShowcase.heading")}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategoryId(c.id)}
            className="group relative aspect-square rounded-2xl overflow-hidden text-start shadow-sm hover:shadow-lg transition-shadow"
          >
            {c.imageUrl ? (
              <>
                <Image
                  src={c.imageUrl}
                  alt={c.name}
                  width={400}
                  height={400}
                  unoptimized
                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="absolute bottom-3 right-3 left-3 font-display font-extrabold text-white text-sm sm:text-base">{c.name}</span>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center" style={{ backgroundColor: `${colors.primary}14` }}>
                <span className="font-display font-extrabold text-sm sm:text-base" style={{ color: colors.primary }}>
                  {c.name}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
