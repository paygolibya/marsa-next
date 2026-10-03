"use client";

import { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

// Showcase stores (store.type === "showcase", e.g. a car exhibition) have
// no checkout at all — this is what every "add to cart"/"اختر الخيارات"
// button is replaced with on them (ProductsSection.tsx and the product
// detail page). Shared so both don't duplicate the form.
export function InquiryModal({
  open,
  onClose,
  storeSlug,
  productId,
  productName,
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
  productId?: string;
  productName?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.createInquiry({ storeSlug, productId, buyerName: name, buyerPhone: phone, message });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إرسال الاستفسار");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setName("");
    setPhone("");
    setMessage("");
    setDone(false);
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={productName ? `استفسار عن ${productName}` : "استفسار"}>
      {done ? (
        <div className="text-center py-6">
          <p className="text-harbor font-bold">تم إرسال استفسارك بنجاح</p>
          <p className="text-rope text-sm mt-1">سيتواصل معك المتجر قريبًا.</p>
          <Button className="mt-4" onClick={handleClose}>
            إغلاق
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">الاسم</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رسالتك</span>
            <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className="input" rows={3} />
          </label>
          {error && <p className="text-signal text-sm">{error}</p>}
          <Button type="submit" loading={sending} loadingText="جارٍ الإرسال..." className="w-full">
            إرسال الاستفسار
          </Button>
        </form>
      )}
    </Modal>
  );
}
