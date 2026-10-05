import ar from "./ar.json";
import en from "./en.json";

export type Language = "ar" | "en";

const DICTIONARIES: Record<Language, Record<string, string>> = { ar, en };

export function isSupportedLanguage(value: string): value is Language {
  return value === "ar" || value === "en";
}

export function dirForLanguage(language: Language): "rtl" | "ltr" {
  return language === "ar" ? "rtl" : "ltr";
}

type TranslatableProductFields = { name?: string; description?: string; metaTitle?: string; metaDescription?: string };

// Falls back field-by-field to the product's own (Arabic) values — a
// language entry that only overrides `name` still gets the real description,
// never a blank one.
export function resolveProductTranslation<
  T extends { name: string; description?: string | null; metaTitle?: string | null; metaDescription?: string | null; translations?: Record<string, TranslatableProductFields> | null },
>(product: T, language: Language) {
  const override = product.translations?.[language];
  return {
    name: override?.name || product.name,
    description: override?.description ?? product.description ?? null,
    metaTitle: override?.metaTitle ?? product.metaTitle ?? null,
    metaDescription: override?.metaDescription ?? product.metaDescription ?? null,
  };
}

export function translate(
  language: Language,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = DICTIONARIES[language]?.[key] ?? DICTIONARIES.ar[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
}
