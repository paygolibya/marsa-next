// A fixed, curated list of merchant industries/niches — a merchant-chosen
// label (Store.industry) separate from Store.type (which drives checkout
// logic). Used today only to collect the data; a future pass can use it to
// recommend dedicated templates once 2-3 niches are picked to actually build
// for (see the "Get Started"/template-differentiation plan history).
export const STORE_INDUSTRIES = [
  { value: "fashion", label: "أزياء وملابس" },
  { value: "shoes_bags", label: "أحذية وحقائب" },
  { value: "beauty_cosmetics", label: "تجميل ومستحضرات عناية" },
  { value: "perfumes", label: "عطور" },
  { value: "watches_accessories", label: "ساعات وإكسسوارات" },
  { value: "eyewear", label: "نظارات" },
  { value: "jewelry", label: "مجوهرات" },
  { value: "baby_kids", label: "مستلزمات أطفال وأمومة" },
  { value: "home_decor", label: "منزل وديكور" },
  { value: "gifts_wrapping", label: "هدايا وتغليف" },
  { value: "electronics", label: "إلكترونيات وأجهزة" },
  { value: "food_bakery", label: "مخابز وحلويات" },
  { value: "pharmacy_health", label: "صيدليات ومستلزمات صحية" },
  { value: "medical_equipment", label: "أجهزة طبية" },
  { value: "pets", label: "مستلزمات حيوانات أليفة" },
  { value: "cleaning_supplies", label: "مستلزمات تنظيف" },
  { value: "books_stationery", label: "كتب وقرطاسية" },
  { value: "sports_fitness", label: "رياضة ولياقة" },
  { value: "services", label: "خدمات" },
  { value: "other", label: "أخرى" },
] as const;

export type StoreIndustry = (typeof STORE_INDUSTRIES)[number]["value"];

export const STORE_INDUSTRY_VALUES = STORE_INDUSTRIES.map((i) => i.value) as [StoreIndustry, ...StoreIndustry[]];

export function storeIndustryLabel(value: string | null | undefined): string | null {
  return STORE_INDUSTRIES.find((i) => i.value === value)?.label ?? null;
}
