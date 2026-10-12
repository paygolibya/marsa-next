"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { SectionEditor } from "@/components/editor/SectionEditor";
import { ToastProvider } from "@/components/ui";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!storeId) {
      router.replace("/onboarding");
      return;
    }
    if (!ready || !token) return;
    api
      .myStores(token)
      .then((stores) => {
        if (!stores.some((s) => s.id === storeId)) {
          router.replace("/onboarding");
          return;
        }
        setLoaded(true);
      })
      .catch(() => router.replace("/onboarding"));
  }, [router, storeId, ready, token]);

  if (!storeId || !loaded) return null;

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* Straight to /dashboard, not /subscription — a merchant who hasn't
            paid yet lands on the dashboard's own "inactive" paywall screen
            with a direct link to /subscription (dashboard/layout.tsx), so
            there's no need to detour through it here too. */}
        <SectionEditor storeId={storeId} onSaved={() => router.push("/dashboard")} />
      </div>
    </ToastProvider>
  );
}
