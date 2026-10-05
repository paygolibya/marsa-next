"use client";

import { useState } from "react";
import { Modal, Button } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { translate, type Language } from "@/lib/i18n";

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
  language = "ar",
}: {
  open: boolean;
  onClose: () => void;
  storeSlug: string;
  productId?: string;
  productName?: string;
  language?: Language;
}) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars);
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
      setError(err instanceof ApiError ? err.message : t("inquiry.errorFallback"));
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
    <Modal open={open} onClose={handleClose} title={productName ? t("inquiry.titleWithProduct", { productName }) : t("inquiry.titlePlain")}>
      {done ? (
        <div className="text-center py-6">
          <p className="text-harbor font-bold">{t("inquiry.successHeading")}</p>
          <p className="text-rope text-sm mt-1">{t("inquiry.successSubtext")}</p>
          <Button className="mt-4" onClick={handleClose}>
            {t("common.close")}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">{t("inquiry.name")}</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">{t("inquiry.phone")}</span>
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">{t("inquiry.message")}</span>
            <textarea required value={message} onChange={(e) => setMessage(e.target.value)} className="input" rows={3} />
          </label>
          {error && <p className="text-signal text-sm">{error}</p>}
          <Button type="submit" loading={sending} loadingText={t("inquiry.sending")} className="w-full">
            {t("inquiry.submit")}
          </Button>
        </form>
      )}
    </Modal>
  );
}
