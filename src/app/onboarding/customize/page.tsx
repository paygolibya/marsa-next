'use client';

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TemplateCustomizer from "@/components/store/TemplateCustomizer";

export default function CustomizePage() {
  return (
    <Suspense fallback={null}>
      <CustomizePageContent />
    </Suspense>
  );
}

function CustomizePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("storeId") ?? "";
  const [templateName] = useState("الحديث");

  useEffect(() => {
    if (!storeId) {
      router.replace("/onboarding");
    }
  }, [router, storeId]);

  if (!storeId) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <TemplateCustomizer storeId={storeId} templateName={templateName} onSave={() => router.push("/subscription")} />
      </div>
    </div>
  );
}
