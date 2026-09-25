"use client";

import { useCurrentStore } from "@/lib/use-current-store";
import { SectionEditor } from "@/components/editor/SectionEditor";

export default function DashboardDesignPage() {
  const { store } = useCurrentStore();
  if (!store) return null;
  return <SectionEditor storeId={store.id} />;
}
