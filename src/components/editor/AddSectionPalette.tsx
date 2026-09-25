import { Modal } from "@/components/ui";
import { SECTION_TYPES, SECTION_TYPE_LABELS, type SectionType } from "@/components/storefront/sections/types";

const SECTION_TYPE_HINTS: Record<SectionType, string> = {
  stats: "عدد الطلبات المُسلَّمة ومتوسط التقييم — أرقام حقيقية من متجرك",
  products: "شبكة منتجاتك — القسم الأساسي",
  testimonials: "من تقييمات حقيقية 4★ فأكثر",
  newsletter: "نموذج جمع بريد الزوار",
};

export function AddSectionPalette({
  open,
  onClose,
  existingTypes,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  existingTypes: SectionType[];
  onAdd: (type: SectionType) => void;
}) {
  // Each section type can only appear once — matches the existing model
  // (Product/stats/testimonials/newsletter are singletons per store, not
  // repeatable blocks yet).
  const available = SECTION_TYPES.filter((t) => !existingTypes.includes(t));

  return (
    <Modal open={open} onClose={onClose} title="إضافة قسم">
      {available.length === 0 ? (
        <p className="text-rope text-sm">أضفت جميع الأقسام المتاحة بالفعل.</p>
      ) : (
        <div className="space-y-2">
          {available.map((type) => (
            <button
              key={type}
              onClick={() => {
                onAdd(type);
                onClose();
              }}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-harbor/10 bg-white p-4 text-right hover:border-brass/50 hover:bg-brass/5 transition-colors"
            >
              <div>
                <p className="font-bold text-harbor text-sm">{SECTION_TYPE_LABELS[type]}</p>
                <p className="text-xs text-rope mt-0.5">{SECTION_TYPE_HINTS[type]}</p>
              </div>
              <span className="text-xl text-brass shrink-0" aria-hidden>
                +
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
