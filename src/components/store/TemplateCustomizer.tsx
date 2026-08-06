'use client';

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Customization {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logo?: string;
  favicon?: string;
  tagline?: string;
  description?: string;
  headerStyle: string;
  footerStyle: string;
  showNewsletter: boolean;
  showReviews: boolean;
  showTestimonials: boolean;
  showSocialProof: boolean;
}

interface TemplateCustomizerProps {
  storeId: string;
  templateName: string;
  onSave?: () => void;
}

export default function TemplateCustomizer({ storeId, templateName, onSave }: TemplateCustomizerProps) {
  const [customization, setCustomization] = useState<Customization>({
    primaryColor: "#0066cc",
    secondaryColor: "#f0f0f0",
    accentColor: undefined,
    logo: undefined,
    favicon: undefined,
    tagline: "",
    description: "",
    headerStyle: "standard",
    footerStyle: "standard",
    showNewsletter: true,
    showReviews: true,
    showTestimonials: false,
    showSocialProof: true,
  });

  const [loading, setLoading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<"primary" | "secondary" | null>(null);

  useEffect(() => {
    fetch(`/api/stores/${storeId}/customize`)
      .then((res) => res.json())
      .then((data) => {
        if (data.customization) {
          setCustomization({ ...customization, ...data.customization });
        }
      });
  }, [storeId]);

  async function handleSave() {
    setLoading(true);
    try {
      const response = await fetch(`/api/stores/${storeId}/customize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customization),
      });

      if (response.ok) {
        alert("✓ تم حفظ التخصيصات بنجاح");
        onSave?.();
      }
    } catch {
      alert("خطأ في حفظ التخصيصات");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">خصص متجرك</h1>
        <p className="text-gray-600">قالب: {templateName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-bold mb-4">الألوان</h2>

            <div className="mb-6">
              <label className="block font-semibold mb-3">اللون الأساسي</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === "primary" ? null : "primary")}
                  className="w-16 h-16 rounded-lg border-2 cursor-pointer hover:border-blue-600 transition"
                  style={{ backgroundColor: customization.primaryColor }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">القيمة الحالية: {customization.primaryColor}</p>
                  {showColorPicker === "primary" && (
                    <div className="mb-3">
                      <HexColorPicker color={customization.primaryColor} onChange={(color) => setCustomization({ ...customization, primaryColor: color })} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-3">اللون الثانوي</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === "secondary" ? null : "secondary")}
                  className="w-16 h-16 rounded-lg border-2 cursor-pointer hover:border-blue-600 transition"
                  style={{ backgroundColor: customization.secondaryColor }}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">القيمة الحالية: {customization.secondaryColor}</p>
                  {showColorPicker === "secondary" && (
                    <div className="mb-3">
                      <HexColorPicker color={customization.secondaryColor} onChange={(color) => setCustomization({ ...customization, secondaryColor: color })} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-bold mb-4">الصور</h2>
            <div className="mb-6">
              <label className="block font-semibold mb-2">شعار المتجر</label>
              <input type="file" accept="image/*" className="block w-full" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) console.log("Logo uploaded:", file);
              }} />
              <p className="text-xs text-gray-500 mt-2">يفضل PNG أو SVG، الحد الأقصى 2MB</p>
            </div>
            <div>
              <label className="block font-semibold mb-2">أيقونة الموقع</label>
              <input type="file" accept="image/*" className="block w-full" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) console.log("Favicon uploaded:", file);
              }} />
              <p className="text-xs text-gray-500 mt-2">يفضل ICO أو PNG صغير، الحد الأقصى 500KB</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-bold mb-4">النصوص</h2>
            <div className="mb-6">
              <label className="block font-semibold mb-2">الشعار</label>
              <input
                type="text"
                placeholder="مثال: الجودة والموثوقية"
                value={customization.tagline || ""}
                onChange={(e) => setCustomization({ ...customization, tagline: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold mb-2">وصف المتجر</label>
              <textarea
                placeholder="اكتب وصفاً قصيراً عن متجرك..."
                value={customization.description || ""}
                onChange={(e) => setCustomization({ ...customization, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-xl font-bold mb-4">الميزات</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showNewsletter} onChange={(e) => setCustomization({ ...customization, showNewsletter: e.target.checked })} className="w-4 h-4" />
                <span>عرض نموذج الاشتراك بالرسائل</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showReviews} onChange={(e) => setCustomization({ ...customization, showReviews: e.target.checked })} className="w-4 h-4" />
                <span>عرض تقييمات المنتجات</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showTestimonials} onChange={(e) => setCustomization({ ...customization, showTestimonials: e.target.checked })} className="w-4 h-4" />
                <span>عرض آراء العملاء</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showSocialProof} onChange={(e) => setCustomization({ ...customization, showSocialProof: e.target.checked })} className="w-4 h-4" />
                <span>عرض عدد العملاء والمبيعات</span>
              </label>
            </div>
          </div>

          <button onClick={handleSave} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-lg transition">
            {loading ? "جاري الحفظ..." : "حفظ التخصيصات"}
          </button>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <h2 className="text-xl font-bold mb-4">معاينة حية</h2>
            <div className="rounded-lg border-2 overflow-hidden" style={{ backgroundColor: customization.secondaryColor }}>
              <div style={{ backgroundColor: customization.primaryColor, color: "white" }} className="p-4">
                <h3 className="font-bold text-lg">متجرك</h3>
                {customization.tagline && <p className="text-sm opacity-90">{customization.tagline}</p>}
              </div>
              <div className="p-4 space-y-3">
                <div style={{ backgroundColor: customization.primaryColor }} className="h-12 rounded text-white flex items-center justify-center font-bold">المنتجات</div>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded bg-gray-200 flex items-center justify-center">صورة منتج {i}</div>
                  ))}
                </div>
                <button style={{ backgroundColor: customization.primaryColor }} className="w-full py-2 rounded text-white font-bold">إضافة للسلة</button>
              </div>
              <div style={{ backgroundColor: customization.primaryColor, color: "white" }} className="p-4 text-center text-sm">© متجرك 2026</div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">هذه معاينة مبسطة. الموقع الفعلي يحتوي على المزيد من الميزات</p>
          </div>
        </div>
      </div>
    </div>
  );
}
