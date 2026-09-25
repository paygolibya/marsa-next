import {
  safeParseSettings,
  statsSettingsSchema,
  productsSettingsSchema,
  testimonialsSettingsSchema,
  newsletterSettingsSchema,
} from "@/components/storefront/sections/schemas";
import type { SectionType } from "@/components/storefront/sections/types";

// One form per section type, reading/writing that type's own settings
// shape (see the Zod schemas) — the same settings a save persists and a
// section component reads at render time, so what's edited here is what
// actually changes on the real storefront.
export function SectionSettingsForm({
  type,
  settings,
  onChange,
}: {
  type: SectionType;
  settings: unknown;
  onChange: (next: unknown) => void;
}) {
  if (type === "stats") {
    const s = safeParseSettings(statsSettingsSchema, settings);
    return (
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={s.showRating} onChange={(e) => onChange({ ...s, showRating: e.target.checked })} className="w-4 h-4 accent-brass" />
        <span className="text-sm text-harbor">عرض متوسط التقييم بجانب عدد الطلبات</span>
      </label>
    );
  }

  if (type === "products") {
    const s = safeParseSettings(productsSettingsSchema, settings);
    return (
      <label className="block">
        <span className="block text-sm font-bold text-harbor mb-1.5">عنوان القسم (اختياري)</span>
        <input value={s.title ?? ""} onChange={(e) => onChange({ ...s, title: e.target.value || undefined })} className="input" placeholder="مثال: تسوّق الآن" />
      </label>
    );
  }

  if (type === "testimonials") {
    const s = safeParseSettings(testimonialsSettingsSchema, settings);
    return (
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">عنوان القسم (اختياري)</span>
          <input value={s.title ?? ""} onChange={(e) => onChange({ ...s, title: e.target.value || undefined })} className="input" placeholder="مثال: آراء عملائنا" />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">أقصى عدد آراء يظهر</span>
          <input
            type="number"
            min={1}
            max={12}
            value={s.limit}
            onChange={(e) => onChange({ ...s, limit: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
            className="input"
            dir="ltr"
          />
        </label>
      </div>
    );
  }

  // newsletter
  const s = safeParseSettings(newsletterSettingsSchema, settings);
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-sm font-bold text-harbor mb-1.5">العنوان (اختياري)</span>
        <input value={s.heading ?? ""} onChange={(e) => onChange({ ...s, heading: e.target.value || undefined })} className="input" placeholder="مثال: اشترك ليصلك كل جديد" />
      </label>
      <label className="block">
        <span className="block text-sm font-bold text-harbor mb-1.5">النص الفرعي (اختياري)</span>
        <input value={s.body ?? ""} onChange={(e) => onChange({ ...s, body: e.target.value || undefined })} className="input" placeholder="مثال: عروض ومنتجات جديدة من متجرك" />
      </label>
    </div>
  );
}
