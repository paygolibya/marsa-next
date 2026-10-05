import { translate, isSupportedLanguage } from "@/lib/i18n";
import { safeParseSettings, categoriesSettingsSchema } from "./schemas";
import type { SectionRenderProps } from "./types";

// One shared pill-row design across all 4 template variants (unlike
// ProductsSection/StatsSection, which each have a bespoke per-variant
// layout) — this is a filter control, not a showcase element, so a single
// consistent design is the right amount of visual investment here.
export function CategoriesSection({ colors, categories, selectedCategoryId, setSelectedCategoryId, settings: rawSettings, store }: SectionRenderProps) {
  const settings = safeParseSettings(categoriesSettingsSchema, rawSettings);
  const language = isSupportedLanguage(store.language) ? store.language : "ar";
  const t = (key: string) => translate(language, key);
  if (categories.length === 0) return null;

  return (
    <div className="mb-6">
      {settings.title && <h2 className="font-display text-lg font-extrabold text-harbor mb-3">{settings.title}</h2>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategoryId(null)}
          className="rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors"
          style={
            selectedCategoryId === null
              ? { backgroundColor: colors.primary, borderColor: colors.primary, color: "white" }
              : { borderColor: "rgba(0,0,0,0.15)", color: colors.text }
          }
        >
          {t("common.all")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategoryId(c.id)}
            className="rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors"
            style={
              selectedCategoryId === c.id
                ? { backgroundColor: colors.primary, borderColor: colors.primary, color: "white" }
                : { borderColor: "rgba(0,0,0,0.15)", color: colors.text }
            }
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
