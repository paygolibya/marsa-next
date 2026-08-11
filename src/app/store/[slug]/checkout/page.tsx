"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store, type VanexCity } from "@/lib/api";
import { useCart } from "@/lib/use-cart";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
  sabil: "دريب السبيل",
  shaheen: "شاهين",
};

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const cart = useCart(slug);

  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet">("cod");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usesVanexPricing = store?.courier === "vanex";
  const [vanexCities, setVanexCities] = useState<VanexCity[]>([]);
  const [vanexCityId, setVanexCityId] = useState("");
  const [vanexAreaId, setVanexAreaId] = useState("");

  useEffect(() => {
    api.publicStore(slug).then(({ store }) => {
      setStore(store);
      const walletAvailable = Boolean(store.walletProvider && store.dpayAvailable);
      setPaymentMethod(store.codEnabled ? "cod" : walletAvailable ? "wallet" : "cod");
    });
  }, [slug]);

  useEffect(() => {
    if (!usesVanexPricing) return;
    api.vanexCities().then(({ cities }) => setVanexCities(cities));
  }, [usesVanexPricing]);

  const walletAvailable = Boolean(store?.walletProvider && store?.dpayAvailable);

  const selectedCity = vanexCities.find((c) => c.id === vanexCityId);
  const selectedArea = selectedCity?.areas.find((a) => a.id === vanexAreaId);
  const shippingCents = usesVanexPricing ? selectedArea?.priceCents ?? 0 : 0;
  const grandTotalCents = cart.subtotalCents + shippingCents;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.lines.length === 0) return;
    if (usesVanexPricing && !selectedArea) {
      setError("اختر المدينة والمنطقة");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await api.createOrder({
        storeSlug: slug,
        items: cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        buyer: {
          name,
          phone,
          city: selectedArea ? `${selectedCity?.name} - ${selectedArea.name}` : city,
          address,
          vanexAreaId: selectedArea?.id,
        },
        paymentMethod,
      });
      cart.clear();
      const q = new URLSearchParams({
        orderId: result.orderId,
        totalCents: String(result.totalCents),
        shippingCents: String(result.shippingCents),
        trackingId: result.trackingId,
        courier: result.courier,
        paymentStatus: result.paymentStatus,
      });
      router.push(`/store/${slug}/confirmation?${q.toString()}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر إتمام الطلب، حاول مجددًا");
    } finally {
      setLoading(false);
    }
  }

  if (!store) return null;

  if (cart.ready && cart.lines.length === 0) {
    return (
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-harbor">سلتك فارغة</h1>
        <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
          العودة إلى المتجر
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 grid md:grid-cols-[1.2fr_1fr] gap-10">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">إتمام الطلب</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">الاسم الكامل</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">رقم الهاتف</span>
            <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
          </label>
          {usesVanexPricing ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-sm font-bold text-harbor mb-1.5">المدينة</span>
                <select
                  required
                  value={vanexCityId}
                  onChange={(e) => {
                    setVanexCityId(e.target.value);
                    setVanexAreaId("");
                  }}
                  className="input"
                >
                  <option value="">اختر المدينة</option>
                  {vanexCities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm font-bold text-harbor mb-1.5">المنطقة</span>
                <select
                  required
                  disabled={!selectedCity}
                  value={vanexAreaId}
                  onChange={(e) => setVanexAreaId(e.target.value)}
                  className="input disabled:opacity-50"
                >
                  <option value="">اختر المنطقة</option>
                  {selectedCity?.areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {formatLYD(a.priceCents)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">المدينة</span>
              <input required value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="طرابلس" />
            </label>
          )}
          <label className="block">
            <span className="block text-sm font-bold text-harbor mb-1.5">العنوان بالتفصيل</span>
            <textarea
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input"
              rows={3}
            />
          </label>

          <div>
            <span className="block text-sm font-bold text-harbor mb-1.5">شركة الشحن</span>
            <p className="rounded-xl border border-harbor/15 bg-white px-4 py-3 text-sm text-rope">
              {courierLabels[store.courier] ?? store.courier}
            </p>
          </div>

          <div>
            <span className="block text-sm font-bold text-harbor mb-2">طريقة الدفع</span>
            <div className="space-y-2">
              {store.codEnabled && (
                <label className="flex items-center gap-2 rounded-xl border border-harbor/15 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === "cod"}
                    onChange={() => setPaymentMethod("cod")}
                    className="accent-brass"
                  />
                  الدفع عند الاستلام
                </label>
              )}
              {walletAvailable && (
                <label className="flex items-center gap-2 rounded-xl border border-harbor/15 bg-white px-4 py-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pm"
                    checked={paymentMethod === "wallet"}
                    onChange={() => setPaymentMethod("wallet")}
                    className="accent-brass"
                  />
                  الدفع الإلكتروني (دي‑باي)
                </label>
              )}
            </div>
          </div>

          {error && <p className="text-signal text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || (usesVanexPricing && !selectedArea)}
            className="w-full rounded-full bg-signal py-3 font-bold text-canvas hover:bg-signal-dark transition-colors disabled:opacity-60"
          >
            {loading ? "جارٍ التأكيد..." : `تأكيد الطلب — ${formatLYD(grandTotalCents)}`}
          </button>
        </form>
      </div>

      <aside className="rounded-2xl border border-harbor/10 bg-white/50 p-6 h-fit">
        <h2 className="font-display font-bold text-harbor mb-4">ملخص الطلب</h2>
        <ul className="space-y-3 text-sm">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex justify-between">
              <span>
                {line.name} × {line.quantity}
              </span>
              <span>{formatLYD(line.priceCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        {usesVanexPricing && (
          <div className="flex justify-between text-sm mt-3 pt-3 border-t border-harbor/10">
            <span>الشحن</span>
            <span>{selectedArea ? formatLYD(shippingCents) : "—"}</span>
          </div>
        )}
        <div className="border-t border-harbor/10 mt-4 pt-4 flex justify-between font-bold text-harbor">
          <span>الإجمالي</span>
          <span>{formatLYD(grandTotalCents)}</span>
        </div>
      </aside>
    </main>
  );
}
