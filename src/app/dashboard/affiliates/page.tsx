"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useCurrentStore } from "@/lib/use-current-store";
import { api, ApiError, formatLYD, type Affiliate } from "@/lib/api";
import { Button, DataTable, type DataTableColumn, EmptyState, Modal, SkeletonRow, useToast } from "@/components/ui";

export default function DashboardAffiliatesPage() {
  const { token } = useAuth();
  const { store } = useCurrentStore();
  const { show } = useToast();
  const [affiliates, setAffiliates] = useState<Affiliate[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("10");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [payingOutId, setPayingOutId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function refresh() {
    if (!token || !store) return;
    api.listAffiliates(token, store.id).then(setAffiliates);
  }

  useEffect(refresh, [token, store]);

  if (!store) return null;

  function openAdd() {
    setName("");
    setPhone("");
    setCommissionPercent("10");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!token || !store || !name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await api.createAffiliate(token, { storeId: store.id, name: name.trim(), phone: phone.trim(), commissionPercent: Number(commissionPercent) || 10 });
      setModalOpen(false);
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حفظ المسوّق", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(affiliate: Affiliate) {
    if (!token || togglingId) return;
    setTogglingId(affiliate.id);
    try {
      const updated = await api.updateAffiliate(token, affiliate.id, { active: !affiliate.active });
      setAffiliates((prev) => prev?.map((a) => (a.id === affiliate.id ? { ...a, active: updated.active } : a)) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تحديث المسوّق", "error");
    } finally {
      setTogglingId(null);
    }
  }

  async function handlePayout(affiliate: Affiliate) {
    if (!token || payingOutId) return;
    if (!window.confirm(`تأكيد تحويل ${formatLYD(affiliate.pendingCents)} لـ "${affiliate.name}"؟ هذا يفترض أنك حوّلت المبلغ له بالفعل خارج النظام.`)) return;
    setPayingOutId(affiliate.id);
    try {
      await api.payoutAffiliate(token, affiliate.id);
      show("تم تسجيل التحويل", "success");
      refresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر تسجيل التحويل", "error");
    } finally {
      setPayingOutId(null);
    }
  }

  async function handleDelete(affiliate: Affiliate) {
    if (!token || deletingId) return;
    if (!window.confirm(`حذف المسوّق "${affiliate.name}"؟`)) return;
    setDeletingId(affiliate.id);
    try {
      await api.deleteAffiliate(token, affiliate.id);
      setAffiliates((prev) => prev?.filter((a) => a.id !== affiliate.id) ?? prev);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "تعذّر حذف المسوّق", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: DataTableColumn<Affiliate>[] = [
    { key: "name", header: "الاسم", accessor: (a) => a.name, sortable: true, render: (a) => <span className="font-bold text-harbor">{a.name}</span> },
    {
      key: "code",
      header: "رابط الإحالة",
      render: (a) => (
        <span className="font-mono text-xs text-rope" dir="ltr">
          ?ref={a.code}
        </span>
      ),
    },
    { key: "commissionPercent", header: "النسبة", render: (a) => `${a.commissionPercent}%` },
    { key: "pendingCents", header: "مستحق", accessor: (a) => a.pendingCents, sortable: true, render: (a) => formatLYD(a.pendingCents) },
    {
      key: "active",
      header: "مفعّل",
      render: (a) => (
        <button
          onClick={() => handleToggle(a)}
          disabled={togglingId === a.id}
          className={`h-6 w-11 rounded-full transition-colors relative disabled:opacity-50 ${a.active ? "bg-brass" : "bg-harbor/20"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${a.active ? "translate-x-0.5" : "translate-x-5"}`} />
        </button>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <div className="flex items-center gap-3">
          {a.pendingCents > 0 && (
            <button
              onClick={() => handlePayout(a)}
              disabled={payingOutId === a.id}
              className="text-xs font-bold text-harbor hover:underline disabled:opacity-50"
            >
              {payingOutId === a.id ? "جارٍ التحويل..." : "تسجيل تحويل"}
            </button>
          )}
          <button
            onClick={() => handleDelete(a)}
            disabled={deletingId === a.id}
            className="text-xs font-bold text-signal hover:underline disabled:opacity-50"
          >
            {deletingId === a.id ? "جارٍ الحذف..." : "حذف"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl font-extrabold text-harbor">برنامج الإحالة</h1>
        <Button onClick={openAdd}>+ مسوّق جديد</Button>
      </div>
      <p className="text-sm text-rope mb-6">
        كل مسوّق يحصل على رابط خاص (?ref=الرمز) — أي طلب يتم عبره يُحتسب له عمولة تلقائيًا. التحويل يتم يدويًا من هنا بعد التحويل الفعلي للمبلغ.
      </p>

      {affiliates === null ? (
        <div className="rounded-2xl border border-harbor/10 bg-white shadow-sm divide-y divide-harbor/5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} columns={6} />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={affiliates}
          rowKey={(a) => a.id}
          searchPlaceholder="ابحث عن مسوّق..."
          searchText={(a) => `${a.name} ${a.code}`}
          pageSize={20}
          emptyState={<EmptyState title="لا يوجد مسوّقون بعد" description="أضف مسوّقين ليشاركوا رابط متجرك مقابل عمولة على كل طلب." />}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="مسوّق جديد"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} loading={saving} loadingText="جارٍ الحفظ..." disabled={!name.trim() || !phone.trim()}>
              حفظ
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">اسم المسوّق</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="مثال: سارة أحمد" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" placeholder="0912345678" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">نسبة العمولة (%)</span>
            <input type="number" min="1" max="100" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="input" dir="ltr" />
          </label>
        </div>
      </Modal>
    </div>
  );
}
