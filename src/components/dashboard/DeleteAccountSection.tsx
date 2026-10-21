"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Button, Modal } from "@/components/ui";

// Self-service account deletion (App Store Guideline 5.1.1(v)). Deletes the
// merchant's account and everything in it — see
// /api/merchant/account/delete. Password re-entry is required; the server
// refuses while a payout is still owed to the merchant.
export function DeleteAccountSection() {
  const { token, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canDelete = password.length > 0 && confirmText.trim() === "حذف";

  async function handleDelete() {
    if (!token || !canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(token, password);
      // Full navigation, not router.replace: clearing the session makes the
      // dashboard layout redirect to /login on its next render, which would
      // otherwise win the race.
      logout();
      window.location.replace("/?accountDeleted=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حذف الحساب، حاول لاحقًا");
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-red-200 bg-red-50/60 p-6">
      <h2 className="font-display text-lg font-extrabold text-red-800">حذف الحساب</h2>
      <p className="mt-1 text-sm text-red-900/80 leading-relaxed">
        يحذف حسابك نهائيًا مع متجرك ومنتجاتك وطلباتك وكل بياناتك على رفقة. لا يمكن التراجع عن هذا الإجراء.
      </p>
      <Button type="button" variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        حذف حسابي
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        title="تأكيد حذف الحساب"
        footer={
          <div className="flex gap-2">
            <Button type="button" variant="danger" onClick={handleDelete} disabled={!canDelete} loading={busy} loadingText="جارٍ الحذف...">
              حذف نهائيًا
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              إلغاء
            </Button>
          </div>
        }
      >
        <p className="text-sm text-harbor/80 leading-relaxed">
          سيتم حذف متجرك وكل منتجاته وطلباته وعملائه وإعداداته ومدفوعات اشتراكك نهائيًا، وسيتوقف رابط متجرك عن العمل.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold text-harbor">كلمة المرور</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </label>
        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-bold text-harbor">اكتب كلمة «حذف» للتأكيد</span>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="input" />
        </label>
        {error && <p className="mt-3 text-sm font-bold text-signal">{error}</p>}
      </Modal>
    </section>
  );
}
