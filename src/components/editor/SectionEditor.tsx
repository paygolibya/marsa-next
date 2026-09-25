"use client";

import { useEffect, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type Product, type Store, type StoreStats, type StoreTestimonial } from "@/lib/api";
import { STOREFRONT_TEMPLATES } from "@/components/storefront/templates/registry";
import ModernTemplate from "@/components/storefront/templates/ModernTemplate";
import type { SectionType } from "@/components/storefront/sections/types";
import { Button, Card, useToast } from "@/components/ui";
import { SectionList, type EditableSection } from "./SectionList";
import { AddSectionPalette } from "./AddSectionPalette";
import { SectionSettingsForm } from "./SectionSettingsForm";

type DraftCustomization = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  logo: string | null;
  favicon: string | null;
  tagline: string;
  description: string;
  headerStyle: string;
  footerStyle: string;
};

const DEFAULT_DRAFT: DraftCustomization = {
  primaryColor: "#0E2A3F",
  secondaryColor: "#EFE9DA",
  accentColor: "#B8752E",
  logo: null,
  favicon: null,
  tagline: "",
  description: "",
  headerStyle: "standard",
  footerStyle: "standard",
};

// Generates a stable client-side id for a section that has none yet (just
// added in this session, not saved) — dnd-kit's sortable context needs a
// stable id per item regardless of whether it's ever been persisted.
function makeLocalId() {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function SectionEditor({ storeId, onSaved }: { storeId: string; onSaved?: () => void }) {
  const { token } = useAuth();
  const { show } = useToast();

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<StoreStats | null>(null);
  const [testimonials, setTestimonials] = useState<StoreTestimonial[]>([]);

  const [draft, setDraft] = useState<DraftCustomization>(DEFAULT_DRAFT);
  const [sections, setSections] = useState<EditableSection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<"primary" | "secondary" | "accent" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preview-only interaction state — nothing here calls a real backend.
  const [query, setQuery] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterState, setNewsletterState] = useState<"idle" | "loading" | "done" | "error">("idle");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const stores = await api.myStores(token!);
        const found = stores.find((s) => s.id === storeId);
        if (!found) throw new Error("Store not found");
        if (cancelled) return;
        setStore(found);

        const [{ customization, sections: fetchedSections }, publicData] = await Promise.all([
          api.getStoreCustomization(token!, storeId),
          api.publicStore(found.slug),
        ]);
        if (cancelled) return;

        setDraft({
          primaryColor: customization.primaryColor,
          secondaryColor: customization.secondaryColor,
          accentColor: customization.accentColor,
          logo: customization.logo,
          favicon: customization.favicon,
          tagline: customization.tagline ?? "",
          description: customization.description ?? "",
          headerStyle: customization.headerStyle,
          footerStyle: customization.footerStyle,
        });
        setSections(fetchedSections.map((s) => ({ id: s.id ?? makeLocalId(), type: s.type, enabled: s.enabled, settings: s.settings })));
        setProducts(publicData.products);
        setStats(publicData.stats);
        setTestimonials(publicData.testimonials);
        setLoaded(true);
      } catch {
        if (!cancelled) setError("تعذّر تحميل بيانات المتجر");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, storeId]);

  function setField<K extends keyof DraftCustomization>(key: K, value: DraftCustomization[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(kind: "logo" | "favicon", file: File) {
    if (!token) return;
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(token, file);
      setField(kind, url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  function handleAddSection(type: SectionType) {
    setSections((prev) => [...prev, { id: makeLocalId(), type, enabled: true, settings: {} }]);
  }

  function handleRemoveSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((prev) => (prev === id ? null : prev));
  }

  function handleToggleEnabled(id: string, enabled: boolean) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function handleSettingsChange(id: string, settings: unknown) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, settings } : s)));
  }

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterState("loading");
    // No real backend behind this — same simulated-success trick the
    // template preview page uses, just enough to show the section working.
    setTimeout(() => {
      setNewsletterState("done");
      setNewsletterEmail("");
    }, 400);
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveStoreCustomization(token, storeId, {
        primaryColor: draft.primaryColor,
        secondaryColor: draft.secondaryColor,
        accentColor: draft.accentColor,
        logo: draft.logo,
        favicon: draft.favicon,
        tagline: draft.tagline,
        description: draft.description,
        headerStyle: draft.headerStyle,
        footerStyle: draft.footerStyle,
        sections: sections.map((s, position) => ({ type: s.type, position, enabled: s.enabled, settings: s.settings })),
      });
      show("تم حفظ التخصيصات", "success");
      onSaved?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ التخصيصات");
      show("تعذّر حفظ التخصيصات", "error");
    } finally {
      setSaving(false);
    }
  }

  const draftStore: Store | null = useMemo(() => {
    if (!store) return null;
    return {
      ...store,
      customization: store.customization
        ? {
            ...store.customization,
            primaryColor: draft.primaryColor,
            secondaryColor: draft.secondaryColor,
            accentColor: draft.accentColor,
            logo: draft.logo,
            favicon: draft.favicon,
            tagline: draft.tagline || null,
            description: draft.description || null,
            headerStyle: draft.headerStyle,
            footerStyle: draft.footerStyle,
          }
        : null,
    };
  }, [store, draft]);

  const filtered = useMemo(() => products.filter((p) => p.name.includes(query)), [products, query]);
  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;
  const Template = draftStore ? STOREFRONT_TEMPLATES[draftStore.customization?.template?.slug ?? "modern"] ?? ModernTemplate : ModernTemplate;

  if (!loaded || !draftStore) {
    return <p className="p-10 text-rope">جارٍ التحميل...</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-6 lg:gap-8 p-4 sm:p-6 lg:p-10">
      <div className="space-y-6 min-w-0">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-1">تصميم المتجر</h1>
          <p className="text-rope text-sm">عدّل مظهر متجرك وأقسامه — التغييرات تظهر في المعاينة فورًا، ولا تُنشر إلا بعد الحفظ.</p>
        </div>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-harbor mb-4">الألوان</h2>
          <ColorField label="اللون الأساسي — الرأس والأزرار" value={draft.primaryColor} onChange={(v) => setField("primaryColor", v)} field="primary" open={showColorPicker} setOpen={setShowColorPicker} />
          <ColorField label="اللون الثانوي — خلفية المتجر" value={draft.secondaryColor} onChange={(v) => setField("secondaryColor", v)} field="secondary" open={showColorPicker} setOpen={setShowColorPicker} />
          <ColorField label="لون التمييز — التقييمات والشارات" value={draft.accentColor ?? "#000000"} onChange={(v) => setField("accentColor", v)} field="accent" open={showColorPicker} setOpen={setShowColorPicker} last />
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-harbor mb-4">الصور</h2>
          <div className="mb-6">
            <label className="block font-bold text-harbor mb-2 text-sm">شعار المتجر</label>
            <div className="flex items-center gap-4">
              {draft.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.logo} alt="الشعار" className="h-14 w-14 rounded-xl object-cover border border-harbor/10" />
              )}
              <label className="flex-1">
                <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
                  {uploadingLogo ? "جارٍ الرفع..." : draft.logo ? "تغيير الشعار" : "اختر شعارًا"}
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
          </div>
          <div>
            <label className="block font-bold text-harbor mb-2 text-sm">أيقونة الموقع (Favicon)</label>
            <div className="flex items-center gap-4">
              {draft.favicon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.favicon} alt="الأيقونة" className="h-10 w-10 rounded-lg object-cover border border-harbor/10" />
              )}
              <label className="flex-1">
                <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
                  {uploadingFavicon ? "جارٍ الرفع..." : draft.favicon ? "تغيير الأيقونة" : "اختر أيقونة"}
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
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-harbor mb-4">النصوص</h2>
          <label className="block mb-4">
            <span className="block text-sm font-bold text-harbor mb-1.5">الشعار النصي (Tagline)</span>
            <input value={draft.tagline} onChange={(e) => setField("tagline", e.target.value)} className="input" placeholder="مثال: الجودة والموثوقية" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">وصف المتجر</span>
            <textarea value={draft.description} onChange={(e) => setField("description", e.target.value)} rows={3} className="input" placeholder="اكتب وصفًا قصيرًا عن متجرك..." />
          </label>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-harbor mb-4">تخطيط المتجر</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">نمط الرأس</span>
              <select value={draft.headerStyle} onChange={(e) => setField("headerStyle", e.target.value)} className="input">
                <option value="standard">قياسي — الشعار على اليمين</option>
                <option value="centered">متمركز — الشعار في المنتصف</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">نمط التذييل</span>
              <select value={draft.footerStyle} onChange={(e) => setField("footerStyle", e.target.value)} className="input">
                <option value="standard">قياسي</option>
                <option value="branded">يعرض اسم متجرك وشعارك</option>
              </select>
            </label>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg font-bold text-harbor">أقسام المتجر</h2>
            <button type="button" onClick={() => setPaletteOpen(true)} className="text-sm font-bold text-brass hover:underline">
              + إضافة قسم
            </button>
          </div>
          <p className="text-xs text-rope mb-4">اسحب الأقسام لإعادة ترتيبها، أو استخدم لوحة المفاتيح — الترتيب هنا هو ما سيراه الزوار.</p>
          <SectionList
            sections={sections}
            selectedId={selectedId}
            onReorder={setSections}
            onToggleEnabled={handleToggleEnabled}
            onRemove={handleRemoveSection}
            onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          />
          {sections.length === 0 && <p className="text-rope text-sm py-4 text-center">لا توجد أقسام بعد — أضف قسمًا للبدء.</p>}

          {selectedSection && (
            <div className="mt-4 rounded-xl border border-brass/40 bg-brass/5 p-4">
              <SectionSettingsForm type={selectedSection.type} settings={selectedSection.settings} onChange={(s) => handleSettingsChange(selectedSection.id, s)} />
            </div>
          )}
        </Card>

        {error && <p className="text-signal text-sm">{error}</p>}

        <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." className="w-full py-3.5 text-lg">
          حفظ التخصيصات
        </Button>
      </div>

      <div className="min-w-0">
        <div className="sticky top-4">
          <h2 className="font-display text-lg font-bold text-harbor mb-3">معاينة حية</h2>
          <div className="rounded-2xl border-2 border-harbor/15 overflow-hidden shadow-sm max-h-[85vh] overflow-y-auto">
            <Template
              slug={draftStore.slug}
              store={draftStore}
              products={products}
              filtered={filtered}
              query={query}
              setQuery={setQuery}
              stats={stats}
              testimonials={testimonials}
              cartTotalItems={0}
              onOpenCart={() => show("معاينة فقط — لا يمكن فتح السلة هنا", "info")}
              onAddToCart={() => show("معاينة فقط — لا يمكن الإضافة للسلة هنا", "info")}
              newsletterEmail={newsletterEmail}
              setNewsletterEmail={setNewsletterEmail}
              newsletterState={newsletterState}
              onNewsletterSubmit={handleNewsletterSubmit}
              sections={sections.map((s, position) => ({ id: s.id, type: s.type, position, enabled: s.enabled, settings: s.settings }))}
            />
          </div>
        </div>
      </div>

      <AddSectionPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        existingTypes={sections.map((s) => s.type)}
        onAdd={handleAddSection}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  field,
  open,
  setOpen,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  field: "primary" | "secondary" | "accent";
  open: "primary" | "secondary" | "accent" | null;
  setOpen: (v: "primary" | "secondary" | "accent" | null) => void;
  last?: boolean;
}) {
  return (
    <div className={last ? "" : "mb-5"}>
      <label className="block font-bold text-harbor mb-2 text-sm">{label}</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(open === field ? null : field)}
          className="w-12 h-12 shrink-0 rounded-xl border-2 border-harbor/15 cursor-pointer hover:border-brass transition-colors"
          style={{ backgroundColor: value }}
          aria-label={label}
        />
        <input dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="input flex-1 font-mono text-sm py-2" placeholder="#000000" />
      </div>
      {open === field && (
        <div className="mt-3">
          <HexColorPicker color={value} onChange={onChange} />
        </div>
      )}
    </div>
  );
}
