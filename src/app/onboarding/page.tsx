"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import TemplateSelector from "@/components/onboarding/TemplateSelector";
import { useAuth } from "@/lib/auth-context";
import { isAdminMerchant } from "@/lib/is-admin";
import { api, ApiError } from "@/lib/api";
import { templatesData } from "@/lib/templates-data";

function slugPreview(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "متجرك"
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { token, merchant, ready } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const courier = "vanex";
  const [codEnabled, setCodEnabled] = useState(true);
  const [walletEnabled, setWalletEnabled] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState("modern");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templatesData[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const themes = [
    { id: "modern", name: "Modern", description: "Clean & Professional" },
    { id: "classic", name: "Classic", description: "Traditional Style" },
    { id: "minimal", name: "Minimal", description: "Simple & Fast" },
    { id: "professional", name: "Professional", description: "Business Look" },
  ];

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  useEffect(() => {
    if (ready && token && isAdminMerchant(merchant)) router.replace("/admin");
  }, [ready, token, merchant, router]);

  useEffect(() => {
    if (ready && token && merchant && !isAdminMerchant(merchant) && !merchant.phoneVerified) {
      router.replace("/verify-phone");
    }
  }, [ready, token, merchant, router]);

  async function handleCreate() {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const store = await api.createStore(token, {
        name,
        theme: selectedTheme,
        courier,
        codEnabled,
        walletProvider: walletEnabled ? "anis" : null,
        templateId: selectedTemplateId,
      });
      router.push(`/onboarding/customize?storeId=${store.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إنشاء المتجر، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !token || isAdminMerchant(merchant) || (merchant && !merchant.phoneVerified)) return null;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-2xl bg-white/90 shadow-xl p-8">
        <div className="flex items-center gap-3 mb-10">
          <StepDot active={step === 1} label="1" done={step > 1} />
          <div className="h-px flex-1 bg-harbor/15" />
          <StepDot active={step === 2} label="2" done={false} />
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-harbor">اسم متجرك</h1>
              <p className="text-rope mt-1">هذا الاسم سيظهر لعملائك، وسيحدد رابط متجرك أيضًا.</p>
            </div>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">اسم المتجر</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="أزياء الحياة"
              />
            </label>
            {name && (
              <p className="text-sm text-rope">
                رابط متجرك: <span dir="ltr" className="text-brass font-bold">rifqa.ly/store/{slugPreview(name)}</span>
              </p>
            )}
            <button
              disabled={!name.trim()}
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-40"
            >
              متابعة
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-harbor">الشحن والدفع</h1>
              <p className="text-rope mt-1">اختر شركة الشحن وطرق الدفع المتاحة لعملائك — يمكنك تغييرها لاحقًا.</p>
            </div>

            <div className="mt-6">
              <label className="block text-right text-lg font-bold mb-4">اختر نمط الموقع (Choose Website Style)</label>
              <div className="grid grid-cols-2 gap-4">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`rounded-lg border-2 p-4 text-center transition ${
                      selectedTheme === theme.id
                        ? "border-brass bg-brass/10"
                        : "border-harbor/15 bg-white hover:border-brass/60"
                    }`}
                  >
                    <div className="font-bold text-harbor">{theme.name}</div>
                    <div className="text-sm text-rope">{theme.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-harbor/10 bg-white p-4">
              <h2 className="mb-4 text-lg font-bold text-harbor">اختر قالب المتجر</h2>
              <TemplateSelector
                templates={templatesData}
                selectedId={selectedTemplateId}
                onSelect={(template) => setSelectedTemplateId(template.id)}
              />
            </div>

            <div>
              <span className="block text-sm font-bold text-harbor mb-1.5">شركة الشحن</span>
              <p className="rounded-xl border border-harbor/15 bg-white px-4 py-3 text-sm text-rope">Vanex</p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-harbor/15 bg-white px-4 py-3">
              <span className="font-bold text-harbor">الدفع عند الاستلام</span>
              <input
                type="checkbox"
                checked={codEnabled}
                onChange={(e) => setCodEnabled(e.target.checked)}
                className="h-5 w-5 accent-brass"
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-harbor/15 bg-white px-4 py-3">
              <span className="font-bold text-harbor">الدفع الإلكتروني (دي‑باي)</span>
              <input
                type="checkbox"
                checked={walletEnabled}
                onChange={(e) => setWalletEnabled(e.target.checked)}
                className="h-5 w-5 accent-brass"
              />
            </div>

            {error && <p className="text-signal text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 rounded-full border border-harbor/20 py-3 font-bold text-harbor hover:bg-harbor/5 transition-colors"
              >
                رجوع
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || (!codEnabled && !walletEnabled)}
                className="flex-1 rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-40"
              >
                {loading ? "جارٍ الإنشاء..." : "إنشاء المتجر"}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span
      className={`stamp h-9 w-9 text-sm font-bold border-2 ${
        active || done ? "border-brass text-brass" : "border-harbor/20 text-harbor/40"
      }`}
    >
      {label}
    </span>
  );
}
