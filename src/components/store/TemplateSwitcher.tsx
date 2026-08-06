'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  nameAr: string;
  thumbnail: string;
  price: number;
}

interface TemplateSwitcherProps {
  currentTemplateId: string;
  storeId: string;
  availableTemplates: Template[];
}

export default function TemplateSwitcher({ currentTemplateId, storeId, availableTemplates }: TemplateSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSwitch(newTemplateId: string) {
    if (!confirm("هل أنت متأكد؟ سيتم تغيير تصميم متجرك")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/templates/${newTemplateId}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });

      if (response.ok) {
        alert("✓ تم تغيير التصميم بنجاح");
        router.refresh();
      }
    } catch {
      alert("خطأ في تغيير التصميم");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold disabled:opacity-50 transition">
        {loading ? "جاري التغيير..." : "تغيير التصميم"}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg p-4 w-80 z-10">
          <h3 className="font-bold mb-3">اختر تصميماً جديداً</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSwitch(template.id)}
                disabled={loading || template.id === currentTemplateId}
                className="w-full text-right p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                <div className="font-bold">{template.nameAr}</div>
                {template.price > 0 && <div className="text-sm text-blue-600">{template.price} د.ل</div>}
                {template.id === currentTemplateId && <div className="text-sm text-green-600">✓ القالب الحالي</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
