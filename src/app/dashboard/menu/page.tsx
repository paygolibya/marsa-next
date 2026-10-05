"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, type NavMenuItem } from "@/lib/api";
import { Button, Card, EmptyState, Modal, SkeletonCard, useToast } from "@/components/ui";

export default function DashboardMenuPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [items, setItems] = useState<NavMenuItem[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listNavMenuItems(token, store.id).then(setItems);
  }

  useEffect(refresh, [token, store]);

  if (!store) return null;

  function openAdd() {
    setLabel("");
    setUrl("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token || !store || !label.trim() || !url.trim()) return;
    setSaving(true);
    try {
      await api.createNavMenuItem(token, { storeId: store.id, label: label.trim(), url: url.trim() });
      setModalOpen(false);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ الرابط", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: NavMenuItem) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف رابط "${item.label}"؟`)) return;
    setDeletingId(item.id);
    try {
      await api.deleteNavMenuItem(token, item.id);
      setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف الرابط", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMove(item: NavMenuItem, direction: "up" | "down") {
    if (!token || !items || movingId) return;
    const sorted = [...items].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((i) => i.id === item.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sorted.length) return;
    const other = sorted[swapIndex];

    setMovingId(item.id);
    try {
      await Promise.all([
        api.updateNavMenuItem(token, item.id, { position: other.position }),
        api.updateNavMenuItem(token, other.id, { position: item.position }),
      ]);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تغيير الترتيب", "error");
    } finally {
      setMovingId(null);
    }
  }

  const sorted = items ? [...items].sort((a, b) => a.position - b.position) : null;

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-extrabold text-harbor">القائمة الرئيسية</h1>
        <Button onClick={openAdd}>+ رابط جديد</Button>
      </div>
      <p className="text-sm text-rope mb-6">الروابط التي تظهر في رأس متجرك — مثل "عن المتجر" أو "سياسة الاستبدال".</p>

      {sorted === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState title="لا توجد روابط بعد" description="أضف روابط لصفحاتك الثابتة أو لمصادر خارجية." />
      ) : (
        <ul className="space-y-3">
          {sorted.map((item, i) => (
            <Card key={item.id} className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3">
              <div className="min-w-0">
                <p className="font-bold text-harbor truncate">{item.label}</p>
                <p className="text-xs text-rope truncate" dir="ltr">
                  {item.url}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleMove(item, "up")}
                  disabled={i === 0 || movingId !== null}
                  className="h-7 w-7 rounded-full border border-harbor/20 text-harbor hover:bg-harbor/5 disabled:opacity-30"
                  aria-label="نقل للأعلى"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMove(item, "down")}
                  disabled={i === sorted.length - 1 || movingId !== null}
                  className="h-7 w-7 rounded-full border border-harbor/20 text-harbor hover:bg-harbor/5 disabled:opacity-30"
                  aria-label="نقل للأسفل"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="text-xs font-bold text-signal hover:underline disabled:opacity-50 mr-2"
                >
                  حذف
                </button>
              </div>
            </Card>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="رابط جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!label.trim() || !url.trim()}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">اسم الرابط</span>
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className="input" placeholder="مثال: عن المتجر" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">المسار أو الرابط</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="input" dir="ltr" placeholder="/page/about أو https://..." />
          </label>
        </div>
      </Modal>
    </div>
  );
}
