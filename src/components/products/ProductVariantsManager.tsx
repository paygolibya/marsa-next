"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type ProductVariant, type ProductVariantOption } from "@/lib/api";

// Real structured variants (e.g. الحجم × اللون), not just a free-text
// label: the merchant defines option types + values here, the server
// generates every combination, and each combination gets its own
// optional price override and its own stock count — used at checkout to
// decrement the right stock, not the parent product's.
export default function ProductVariantsManager({
  productId,
  variantOptions,
  variants,
  onUpdate,
}: {
  productId: string;
  variantOptions: ProductVariantOption[] | null;
  variants: ProductVariant[];
  onUpdate: (variantOptions: ProductVariantOption[], variants: ProductVariant[]) => void;
}) {
  const { token } = useAuth();
  const [optionRows, setOptionRows] = useState<{ name: string; valuesText: string }[]>(
    variantOptions?.length ? variantOptions.map((o) => ({ name: o.name, valuesText: o.values.join("، ") })) : [{ name: "", valuesText: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveOptions() {
    if (!token) return;
    const options = optionRows
      .map((r) => ({ name: r.name.trim(), values: r.valuesText.split(/[,،]/).map((v) => v.trim()).filter(Boolean) }))
      .filter((o) => o.name && o.values.length > 0);

    setSaving(true);
    setError(null);
    try {
      const result = await api.setProductVariantOptions(token, productId, options);
      onUpdate(result.variantOptions, result.variants);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حفظ الخيارات");
    } finally {
      setSaving(false);
    }
  }

  async function handleVariantSave(variantId: string, data: { priceCents: number | null; stockQty: number }) {
    if (!token) return;
    const updated = await api.updateProductVariant(token, productId, variantId, data);
    onUpdate(variantOptions ?? [], variants.map((v) => (v.id === variantId ? updated : v)));
  }

  async function handleVariantDelete(variantId: string) {
    if (!token) return;
    await api.deleteProductVariant(token, productId, variantId);
    onUpdate(variantOptions ?? [], variants.filter((v) => v.id !== variantId));
  }

  return (
    <div className="rounded-lg border border-harbor/15 p-3 space-y-3">
      <p className="text-sm font-bold text-harbor">المتغيرات (المقاس، اللون...)</p>

      {optionRows.map((row, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input
            placeholder="اسم الخيار (مثال: الحجم)"
            value={row.name}
            onChange={(e) => setOptionRows(optionRows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
            className="input text-sm !py-1.5"
          />
          <input
            placeholder="القيم مفصولة بفاصلة (S، M، L)"
            dir="rtl"
            value={row.valuesText}
            onChange={(e) => setOptionRows(optionRows.map((r, idx) => (idx === i ? { ...r, valuesText: e.target.value } : r)))}
            className="input text-sm !py-1.5"
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        {optionRows.length < 2 && (
          <button type="button" onClick={() => setOptionRows([...optionRows, { name: "", valuesText: "" }])} className="text-xs font-bold text-brass">
            + خيار آخر
          </button>
        )}
        <button
          type="button"
          onClick={handleSaveOptions}
          disabled={saving}
          className="rounded-full bg-harbor px-4 py-1.5 text-xs font-bold text-canvas hover:bg-harbor-deep disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ الخيارات وإنشاء المتغيرات"}
        </button>
      </div>
      {error && <p className="text-signal text-xs">{error}</p>}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs mt-1">
            <thead>
              <tr className="text-rope">
                <th className="text-right py-1 font-bold">المتغير</th>
                <th className="text-right py-1 font-bold">السعر (فارغ = سعر المنتج)</th>
                <th className="text-right py-1 font-bold">الكمية</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <VariantRow key={v.id} variant={v} onSave={(data) => handleVariantSave(v.id, data)} onDelete={() => handleVariantDelete(v.id)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariantRow({
  variant,
  onSave,
  onDelete,
}: {
  variant: ProductVariant;
  onSave: (data: { priceCents: number | null; stockQty: number }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [price, setPrice] = useState(variant.priceCents != null ? String(variant.priceCents / 100) : "");
  const [stock, setStock] = useState(String(variant.stockQty));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const label = Object.values(variant.options).join(" — ");

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await onSave({
        priceCents: price.trim() ? Math.round(parseFloat(price) * 100) : null,
        stockQty: Number(stock) || 0,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-harbor/5">
      <td className="py-1.5 font-bold text-harbor">{label}</td>
      <td className="py-1.5">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={variant.priceCents == null ? "افتراضي" : ""}
          dir="ltr"
          type="number"
          step="0.01"
          className="input !py-1 !px-2 text-xs w-24"
        />
      </td>
      <td className="py-1.5">
        <input value={stock} onChange={(e) => setStock(e.target.value)} dir="ltr" type="number" min="0" className="input !py-1 !px-2 text-xs w-16" />
      </td>
      <td className="py-1.5 whitespace-nowrap">
        <button type="button" onClick={handleSave} disabled={saving} className="text-brass font-bold ml-2">
          {saving ? "..." : saved ? "✓" : "حفظ"}
        </button>
        <button type="button" onClick={() => void onDelete()} className="text-signal font-bold">
          حذف
        </button>
      </td>
    </tr>
  );
}
