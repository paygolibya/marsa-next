"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

interface Customization {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string | null;
  logo?: string | null;
  favicon?: string | null;
  tagline?: string | null;
  description?: string | null;
  headerStyle: string; // 'standard' | 'centered'
  footerStyle: string; // 'standard' | 'branded'
  showNewsletter: boolean;
  showReviews: boolean;
  showTestimonials: boolean;
  showSocialProof: boolean;
}

interface TemplateCustomizerProps {
  storeId: string;
  storeName: string;
  templateName: string;
  onSave?: () => void;
}

const DEFAULTS: Customization = {
  primaryColor: "#0E2A3F",
  secondaryColor: "#EFE9DA",
  accentColor: "#B8752E",
  logo: null,
  favicon: null,
  tagline: "",
  description: "",
  headerStyle: "standard",
  footerStyle: "standard",
  showNewsletter: true,
  showReviews: true,
  showTestimonials: false,
  showSocialProof: true,
};

export default function TemplateCustomizer({ storeId, storeName, templateName, onSave }: TemplateCustomizerProps) {
  const { token } = useAuth();
  const [customization, setCustomization] = useState<Customization>(DEFAULTS);

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<"primary" | "secondary" | "accent" | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => {
    fetch(`/api/stores/${storeId}/customize`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.customization) {
          setCustomization((prev) => ({ ...prev, ...data.customization }));
        }
      });
  }, [storeId]);

  function set<K extends keyof Customization>(key: K, value: Customization[K]) {
    setCustomization((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleImageUpload(kind: "logo" | "favicon", file: File) {
    if (!token) return;
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(token, file);
      set(kind, url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/stores/${storeId}/customize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customization),
      });

      if (!response.ok) throw new Error("فشل حفظ التخصيصات");
      setSaved(true);
      onSave?.();
    } catch {
      setError("تعذّر حفظ التخصيصات، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  const ColorField = ({ label, field }: { label: string; field: "primary" | "secondary" | "accent" }) => {
    const key = (field + "Color") as "primaryColor" | "secondaryColor" | "accentColor";
    const value = customization[key] || "#000000";
    return (
      <div className="mb-5">
        <label className="block font-bold text-harbor mb-2 text-sm">{label}</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowColorPicker(showColorPicker === field ? null : field)}
            className="w-12 h-12 shrink-0 rounded-xl border-2 border-harbor/15 cursor-pointer hover:border-brass transition-colors"
            style={{ backgroundColor: value }}
            aria-label={label}
          />
          <input
            dir="ltr"
            value={value}
            onChange={(e) => set(key, e.target.value)}
            className="input flex-1 font-mono text-sm py-2"
            placeholder="#000000"
          />
        </div>
        {showColorPicker === field && (
          <div className="mt-3">
            <HexColorPicker color={value} onChange={(color) => set(key, color)} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-harbor mb-1">خصص متجرك</h1>
        <p className="text-rope">قالب: {templateName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-harbor/10 bg-white/60 p-6">
            <h2 className="font-display text-lg font-bold text-harbor mb-4">الألوان</h2>
            <ColorField label="اللون الأساسي — الرأس والأزرار" field="primary" />
            <ColorField label="اللون الثانوي — خلفية المتجر" field="secondary" />
            <ColorField label="لون التمييز — التقييمات والشارات" field="accent" />
          </div>

          <div className="rounded-2xl border border-harbor/10 bg-white/60 p-6">
            <h2 className="font-display text-lg font-bold text-harbor mb-4">الصور</h2>
            <div className="mb-6">
              <label className="block font-bold text-harbor mb-2 text-sm">شعار المتجر</label>
              <div className="flex items-center gap-4">
                {customization.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customization.logo} alt="الشعار" className="h-14 w-14 rounded-xl object-cover border border-harbor/10" />
                )}
                <label className="flex-1">
                  <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
                    {uploadingLogo ? "جارٍ الرفع..." : customization.logo ? "تغيير الشعار" : "اختر شعارًا"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload("logo", file);
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-rope mt-2">يفضل PNG أو SVG، الحد الأقصى 2MB</p>
            </div>
            <div>
              <label className="block font-bold text-harbor mb-2 text-sm">أيقونة الموقع (Favicon)</label>
              <div className="flex items-center gap-4">
                {customization.favicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={customization.favicon} alt="الأيقونة" className="h-10 w-10 rounded-lg object-cover border border-harbor/10" />
                )}
                <label className="flex-1">
                  <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
                    {uploadingFavicon ? "جارٍ الرفع..." : customization.favicon ? "تغيير الأيقونة" : "اختر أيقونة"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/x-icon,image/vnd.microsoft.icon"
                    className="hidden"
                    disabled={uploadingFavicon}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleImageUpload("favicon", file);
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-rope mt-2">يفضل ICO أو PNG صغير، الحد الأقصى 2MB</p>
            </div>
          </div>

          <div className="rounded-2xl border border-harbor/10 bg-white/60 p-6">
            <h2 className="font-display text-lg font-bold text-harbor mb-4">النصوص</h2>
            <div className="mb-5">
              <label className="block font-bold text-harbor mb-2 text-sm">الشعار النصي (Tagline)</label>
              <input
                type="text"
                placeholder="مثال: الجودة والموثوقية"
                value={customization.tagline || ""}
                onChange={(e) => set("tagline", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block font-bold text-harbor mb-2 text-sm">وصف المتجر</label>
              <textarea
                placeholder="اكتب وصفاً قصيراً عن متجرك..."
                value={customization.description || ""}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="input"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-harbor/10 bg-white/60 p-6">
            <h2 className="font-display text-lg font-bold text-harbor mb-4">تخطيط المتجر</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-harbor mb-2 text-sm">نمط الرأس</label>
                <select value={customization.headerStyle} onChange={(e) => set("headerStyle", e.target.value)} className="input">
                  <option value="standard">قياسي — الشعار على اليمين</option>
                  <option value="centered">متمركز — الشعار في المنتصف</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-harbor mb-2 text-sm">نمط التذييل</label>
                <select value={customization.footerStyle} onChange={(e) => set("footerStyle", e.target.value)} className="input">
                  <option value="standard">قياسي</option>
                  <option value="branded">يعرض اسم متجرك وشعارك</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-harbor/10 bg-white/60 p-6">
            <h2 className="font-display text-lg font-bold text-harbor mb-4">الميزات</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showNewsletter} onChange={(e) => set("showNewsletter", e.target.checked)} className="w-4 h-4 accent-brass" />
                <span className="text-sm">عرض نموذج الاشتراك بالرسائل (جمع بريد الزوار)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showReviews} onChange={(e) => set("showReviews", e.target.checked)} className="w-4 h-4 accent-brass" />
                <span className="text-sm">عرض تقييمات المنتجات</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showTestimonials} onChange={(e) => set("showTestimonials", e.target.checked)} className="w-4 h-4 accent-brass" />
                <span className="text-sm">عرض آراء العملاء (من تقييمات حقيقية 4★ فأكثر)</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={customization.showSocialProof} onChange={(e) => set("showSocialProof", e.target.checked)} className="w-4 h-4 accent-brass" />
                <span className="text-sm">عرض عدد الطلبات المُسلَّمة ومتوسط التقييم (أرقام حقيقية من متجرك)</span>
              </label>
            </div>
          </div>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-full bg-signal hover:bg-signal-dark disabled:opacity-50 text-canvas py-3.5 font-bold text-lg transition-colors"
          >
            {loading ? "جارٍ الحفظ..." : saved ? "✓ تم الحفظ" : "حفظ التخصيصات"}
          </button>
        </div>

        {/* Live preview — mirrors src/app/store/[slug]/page.tsx's actual
            structure/typography (not a generic mockup), so what a merchant
            sees here is genuinely close to what buyers will see. */}
        <div className="lg:col-span-1">
          <div className="sticky top-4">
            <h2 className="font-display text-lg font-bold text-harbor mb-3">معاينة حية</h2>
            <div className="rounded-2xl border-2 border-harbor/15 overflow-hidden shadow-sm" style={{ backgroundColor: customization.secondaryColor }}>
              <header
                className={`p-4 ${customization.headerStyle === "centered" ? "text-center" : "flex items-center justify-between gap-3"}`}
                style={{ backgroundColor: customization.primaryColor }}
              >
                <div className={`flex items-center gap-2 ${customization.headerStyle === "centered" ? "justify-center" : ""}`}>
                  {customization.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customization.logo} alt="" className="h-8 w-8 rounded-full object-cover" />
                  )}
                  <div>
                    <p className="font-display font-extrabold text-white text-sm">{storeName}</p>
                    {customization.tagline && <p className="text-[11px] text-white/80">{customization.tagline}</p>}
                  </div>
                </div>
                {customization.headerStyle !== "centered" && (
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white">سلة التسوق</span>
                )}
              </header>

              <div className="p-4">
                {customization.description && <p className="text-xs mb-3" style={{ color: customization.primaryColor }}>{customization.description}</p>}

                {customization.showSocialProof && (
                  <div className="mb-3 flex gap-2 text-[11px] font-bold" style={{ color: customization.accentColor || customization.primaryColor }}>
                    <span className="rounded-full bg-white px-2 py-1">+120 طلب مُسلَّم</span>
                    <span className="rounded-full bg-white px-2 py-1">★ 4.8</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-lg bg-white border border-black/5 overflow-hidden">
                      <div className="aspect-square bg-black/5 flex items-center justify-center text-[10px] text-rope">لا توجد صورة</div>
                      <div className="p-2">
                        <p className="text-[11px] font-bold" style={{ color: customization.primaryColor }}>
                          منتج {i}
                        </p>
                        <button className="mt-1.5 w-full rounded-full text-white text-[10px] font-bold py-1" style={{ backgroundColor: customization.primaryColor }}>
                          أضف إلى السلة
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {customization.showTestimonials && (
                  <div className="mt-3 rounded-lg bg-white p-2 border border-black/5">
                    <p className="text-[10px] font-bold" style={{ color: customization.accentColor || customization.primaryColor }}>★★★★★</p>
                    <p className="text-[10px] text-rope mt-0.5">&quot;منتج ممتاز وخدمة سريعة&quot; — عميل</p>
                  </div>
                )}

                {customization.showNewsletter && (
                  <div className="mt-3 rounded-lg border border-dashed border-black/10 p-2 text-center">
                    <p className="text-[10px] text-rope">اشترك ليصلك كل جديد</p>
                  </div>
                )}
              </div>

              <footer className="p-3 text-center" style={{ backgroundColor: customization.primaryColor }}>
                {customization.footerStyle === "branded" && (
                  <p className="text-[11px] font-bold text-white mb-1">{storeName}</p>
                )}
                <p className="text-[9px] text-white/70">رفقة — منتج من مرسى</p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
