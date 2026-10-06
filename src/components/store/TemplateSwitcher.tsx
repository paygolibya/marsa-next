"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface Template {
  id: string;
  slug: string;
  nameAr: string;
  thumbnail: string;
  price: number;
}

interface TemplateSwitcherProps {
  // The store's currently-assigned template, identified by slug — that's
  // all src/lib/api.ts's Store.customization.template carries (no id),
  // and the switch endpoint already accepts either an id or a slug in its
  // URL segment, so slug-matching here needs no extra data fetched.
  currentTemplateSlug: string | null;
  storeId: string;
  availableTemplates: Template[];
  // Template changes aren't picked up by useCurrentStore (no refresh()
  // there) — the caller reloads, matching how a store-type change is
  // already handled on this same settings page.
  onSwitched: () => void;
}

export default function TemplateSwitcher({ currentTemplateSlug, storeId, availableTemplates, onSwitched }: TemplateSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  async function handleSwitch(newTemplateSlug: string) {
    if (!window.confirm("هل أنت متأكد؟ سيتم تغيير تصميم متجرك")) return;
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${newTemplateSlug}/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ storeId }),
      });

      if (response.ok) {
        onSwitched();
      } else {
        setError("تعذّر تغيير التصميم، حاول مجددًا");
      }
    } catch {
      setError("تعذّر تغيير التصميم، حاول مجددًا");
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

      {error && <p className="text-signal text-sm mt-2">{error}</p>}

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg p-4 w-80 z-10">
          <h3 className="font-bold mb-3">اختر تصميماً جديداً</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availableTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSwitch(template.slug)}
                disabled={loading || template.slug === currentTemplateSlug}
                className="w-full text-right p-3 border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
              >
                <div className="font-bold">{template.nameAr}</div>
                {template.price > 0 && <div className="text-sm text-blue-600">{template.price} د.ل</div>}
                {template.slug === currentTemplateSlug && <div className="text-sm text-green-600">✓ القالب الحالي</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
