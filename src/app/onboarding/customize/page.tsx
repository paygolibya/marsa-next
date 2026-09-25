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
        {/* Used to send new merchants to /subscription to pick a paid plan
            before finishing setup — now that signup grants a 90-day trial
            with full access immediately (see /api/auth/register), there's
            nothing to pay for yet, so straight to the dashboard instead. */}
        <SectionEditor storeId={storeId} onSaved={() => router.push("/dashboard")} />
      </div>
    </ToastProvider>
  );
}
