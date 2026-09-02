"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
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
  const { token, ready } = useAuth();
  const storeId = searchParams.get("storeId") ?? "";
  const [storeName, setStoreName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storeId) {
      router.replace("/onboarding");
      return;
    }
    if (!ready || !token) return;
    // Previously hardcoded to "الحديث" regardless of which template was
    // actually picked — fetch the real store + its actual template name.
    api
      .myStores(token)
      .then((stores) => {
        const store = stores.find((s) => s.id === storeId);
        if (!store) {
          router.replace("/onboarding");
          return;
        }
        setStoreName(store.name);
        setTemplateName(store.customization?.template?.nameAr ?? "الحديث");
        setLoaded(true);
      })
      .catch(() => router.replace("/onboarding"));
  }, [router, storeId, ready, token]);

  if (!storeId || !loaded) return null;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Used to send new merchants to /subscription to pick a paid plan
            before finishing setup — now that signup grants a 90-day trial
            with full access immediately (see /api/auth/register), there's
            nothing to pay for yet, so straight to the dashboard instead. */}
        <TemplateCustomizer storeId={storeId} storeName={storeName} templateName={templateName} onSave={() => router.push("/dashboard")} />
      </div>
    </div>
  );
}
