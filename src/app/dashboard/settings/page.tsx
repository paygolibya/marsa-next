"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type StoreType, type Template } from "@/lib/api";
import DomainSettings from "@/components/store/DomainSettings";
import TemplateSwitcher from "@/components/store/TemplateSwitcher";
import { Button } from "@/components/ui";

const STORE_TYPES: { value: StoreType; label: string; description: string }[] = [
  { value: "physical", label: "منتجات فعلية", description: "شحن عبر Vanex، دفع عند الاستلام أو إلكتروني" },
  { value: "digital", label: "منتجات رقمية", description: "لا يوجد شحن — يُؤكَّد الطلب فورًا" },
  { value: "booking", label: "حجز مواعيد", description: "العميل يحجز موعدًا بدلاً من عنوان توصيل" },
  { value: "rental", label: "تأجير", description: "السعر يومي، العميل يحدد تاريخ الاستلام والإرجاع" },
  { value: "showcase", label: "عرض فقط (استفسار)", description: "بدون شراء مباشر — العميل يرسل استفسارًا" },
];

const LANGUAGE_OPTIONS: { value: "ar" | "en"; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];

const DAY_LABELS: { key: string; label: string }[] = [
  { key: "0", label: "الأحد" },
  { key: "1", label: "الإثنين" },
  { key: "2", label: "الثلاثاء" },
  { key: "3", label: "الأربعاء" },
  { key: "4", label: "الخميس" },
  { key: "5", label: "الجمعة" },
  { key: "6", label: "السبت" },
];

type DayHours = { open: string; close: string } | null;

export default function DashboardSettingsPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const [aboutText, setAboutText] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("");
  const [businessHours, setBusinessHours] = useState("");
  const [storeType, setStoreType] = useState<StoreType>("physical");
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [workingHours, setWorkingHours] = useState<Record<string, DayHours>>({});
  const [language, setLanguage] = useState<"ar" | "en">("ar");
  const [supportedLanguages, setSupportedLanguages] = useState<("ar" | "en")[]>(["ar"]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);

  // Scoped to the store's actual saved type (not the pending `storeType`
  // form state above) — switching templates acts on the store as it
  // exists today, not an unsaved in-progress type change.
  useEffect(() => {
    if (!store) return;
    api.listTemplates(store.type).then(({ templates }) => setAvailableTemplates(templates));
  }, [store]);

  useEffect(() => {
    if (!store) return;
    setAboutText(store.aboutText ?? "");
    setReturnPolicy(store.returnPolicy ?? "");
    setShippingPolicy(store.shippingPolicy ?? "");
    setBusinessHours(store.businessHours ?? "");
    setStoreType(store.type);
    setSlotMinutes(store.bookingSlotMinutes ?? 60);
    setWorkingHours(store.bookingWorkingHours ?? {});
    setLanguage(store.language === "en" ? "en" : "ar");
    setSupportedLanguages(store.supportedLanguages?.length ? (store.supportedLanguages.filter((l): l is "ar" | "en" => l === "ar" || l === "en")) : ["ar"]);
  }, [store]);

  function toggleSupportedLanguage(value: "ar" | "en", checked: boolean) {
    setSupportedLanguages((prev) => {
      const next = checked ? [...prev, value] : prev.filter((l) => l !== value);
      return next.length > 0 ? next : prev;
    });
  }

  function toggleDayClosed(day: string, closed: boolean) {
    setWorkingHours((prev) => ({ ...prev, [day]: closed ? null : { open: "09:00", close: "17:00" } }));
  }

  function updateDayTime(day: string, field: "open" | "close", value: string) {
    setWorkingHours((prev) => ({ ...prev, [day]: { ...(prev[day] ?? { open: "09:00", close: "17:00" }), [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !store) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    const typeChanged = storeType !== store.type;
    try {
      await api.updateStoreSettings(token, store.id, {
        aboutText: aboutText || null,
        returnPolicy: returnPolicy || null,
        shippingPolicy: shippingPolicy || null,
        businessHours: businessHours || null,
        type: storeType,
        bookingSlotMinutes: storeType === "booking" ? slotMinutes : null,
        bookingWorkingHours: storeType === "booking" ? workingHours : null,
        language,
        supportedLanguages: supportedLanguages.includes(language) ? supportedLanguages : [...supportedLanguages, language],
      });
      setSaved(true);
      // The dashboard sidebar/nav depends on store.type (e.g. "الاستفسارات"
      // vs "الطلبات") and useCurrentStore has no refresh() — a full reload
      // is the simplest way to pick that up, acceptable since changing a
      // store's type is a rare, deliberate action, not routine saving.
      if (typeChanged) window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  if (!store) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-2xl">
      <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">إعدادات المتجر</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <span className="block text-sm font-bold text-harbor mb-2">نوع المتجر</span>
          <div className="grid sm:grid-cols-2 gap-2">
            {STORE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStoreType(t.value)}
                className={`text-right rounded-xl border-2 px-4 py-3 transition-colors ${
                  storeType === t.value ? "border-signal bg-signal/5" : "border-harbor/15 bg-canvas hover:border-harbor/25"
                }`}
              >
                <span className="block font-bold text-harbor text-sm">{t.label}</span>
                <span className="block text-xs text-rope mt-0.5">{t.description}</span>
              </button>
            ))}
          </div>
        </div>

        {availableTemplates.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-harbor/15 p-4">
            <div>
              <span className="block text-sm font-bold text-harbor">تصميم المتجر</span>
              <span className="block text-xs text-rope mt-0.5">
                {store.customization?.template?.nameAr ? `الحالي: ${store.customization.template.nameAr}` : "لم يُحدَّد تصميم بعد"}
              </span>
            </div>
            <TemplateSwitcher
              currentTemplateSlug={store.customization?.template?.slug ?? null}
              storeId={store.id}
              availableTemplates={availableTemplates}
              onSwitched={() => window.location.reload()}
            />
          </div>
        )}

        {storeType === "booking" && (
          <div className="rounded-xl border border-harbor/15 p-4 space-y-4">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">مدة الموعد</span>
              <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))} className="input">
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} دقيقة
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="block text-sm font-bold text-harbor mb-2">ساعات العمل</span>
              <div className="space-y-2">
                {DAY_LABELS.map(({ key, label }) => {
                  const day = workingHours[key];
                  const closed = !day;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 w-28 shrink-0">
                        <input type="checkbox" checked={!closed} onChange={(e) => toggleDayClosed(key, !e.target.checked)} />
                        <span className="text-sm text-harbor">{label}</span>
                      </label>
                      {!closed && (
                        <>
                          <input
                            type="time"
                            value={day.open}
                            onChange={(e) => updateDayTime(key, "open", e.target.value)}
                            className="input !py-1.5"
                          />
                          <span className="text-rope text-sm">إلى</span>
                          <input
                            type="time"
                            value={day.close}
                            onChange={(e) => updateDayTime(key, "close", e.target.value)}
                            className="input !py-1.5"
                          />
                        </>
                      )}
                      {closed && <span className="text-xs text-rope">مغلق</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-harbor/15 p-4 space-y-3">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">لغة المتجر الافتراضية</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as "ar" | "en")} className="input">
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="block text-sm font-bold text-harbor mb-1.5">اللغات المتاحة للعميل</span>
            <div className="flex gap-4">
              {LANGUAGE_OPTIONS.map((l) => (
                <label key={l.value} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={supportedLanguages.includes(l.value)}
                    onChange={(e) => toggleSupportedLanguage(l.value, e.target.checked)}
                  />
                  <span className="text-sm text-harbor">{l.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">عن المتجر</span>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="input"
            rows={3}
            placeholder="نبذة قصيرة عن متجرك"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">سياسة الإرجاع</span>
          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            className="input"
            rows={4}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">سياسة الشحن</span>
          <textarea
            value={shippingPolicy}
            onChange={(e) => setShippingPolicy(e.target.value)}
            className="input"
            rows={4}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-bold text-harbor mb-1.5">ساعات العمل</span>
          <input
            value={businessHours}
            onChange={(e) => setBusinessHours(e.target.value)}
            className="input"
            placeholder="السبت–الخميس: 9ص–9م"
          />
        </label>

        {error && <p className="text-signal text-sm">{error}</p>}
        {saved && <p className="text-sm text-green-700">✓ تم الحفظ</p>}

        <Button type="submit" loading={saving} loadingText="جارٍ الحفظ...">
          حفظ الإعدادات
        </Button>
      </form>

      <DomainSettings storeId={store.id} />
    </div>
  );
}
