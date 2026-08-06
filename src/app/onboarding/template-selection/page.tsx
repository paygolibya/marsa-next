'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TemplateSelector from "@/components/onboarding/TemplateSelector";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { templatesData } from "@/lib/templates-data";

export default function TemplateSelectionPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(templatesData[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { token, ready } = useAuth();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  async function handleContinue() {
    if (!selectedTemplate || !token) return;

    setLoading(true);
    try {
      const store = await api.createStore(token, {
        name: "متجري الجديد",
        templateId: selectedTemplate,
      });
      router.push(`/onboarding/customize?storeId=${store.id}`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "خطأ في إنشاء المتجر");
    } finally {
      setLoading(false);
    }
  }

  if (!ready || !token) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <TemplateSelector templates={templatesData} selectedId={selectedTemplate} onSelect={(template) => setSelectedTemplate(template.id)} />
        <div className="flex gap-4 mt-12 pb-8 justify-center">
          <button onClick={() => router.back()} className="px-8 py-3 border rounded-lg font-bold hover:bg-gray-50">رجوع</button>
          <button onClick={handleContinue} disabled={!selectedTemplate || loading} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold">
            {loading ? "جاري الإنشاء..." : "متابعة"}
          </button>
        </div>
      </div>
    </div>
  );
}
