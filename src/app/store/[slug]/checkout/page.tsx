"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, formatLYD, type Store, type VanexCity } from "@/lib/api";
import { useCart } from "@/lib/use-cart";
import { getReferralCode } from "@/lib/referral";
import { trackEvent } from "@/lib/track-event";
import { isSupportedLanguage } from "@/lib/i18n";
import { useTranslation } from "@/lib/i18n/useTranslation";

const courierLabels: Record<string, string> = {
  vanex: "Vanex",
};

// UTC-safe: new Date("2026-11-05") parses as UTC midnight, so mutating it
// with the LOCAL setDate()/getDate() pair can land on the wrong calendar
// day in a browser whose timezone isn't UTC (anything west of Greenwich).
// setUTCDate()/getUTCDate() keep the whole computation in the same frame
// the string was parsed in.
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

declare global {
  interface Window {
    Lightbox?: {
      Checkout: {
        configure: Record<string, unknown>;
        showLightbox: () => void;
        closeLightbox: () => void;
      };
    };
  }
}

// Loads Moamalat's LightBox widget script at most once per page — the
// script itself defines window.Lightbox, so a second injection would just
// redefine the same global.
let lightboxScriptPromise: Promise<void> | null = null;
function loadLightboxScript(src: string): Promise<void> {
  if (window.Lightbox) return Promise.resolve();
  if (!lightboxScriptPromise) {
    lightboxScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("failed to load lightbox.js"));
      document.body.appendChild(script);
    });
  }
  return lightboxScriptPromise;
}

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const cart = useCart(slug);

  const [store, setStore] = useState<Store | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "wallet">("cod");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // True only once order creation confirms the store is genuinely gone
  // (re-checked, not just a single 404) — renders a dedicated blocking
  // message instead of leaving the buyer staring at a raw inline error.
  const [storeGone, setStoreGone] = useState(false);
  // True while the Moamalat widget is open / being finalized — keeps the
  // submit button disabled without reusing `loading` (which also covers
  // the initial /api/orders call).
  const [walletPending, setWalletPending] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);

  const usesVanexPricing = store?.courier === "vanex" && store?.type === "physical";
  const [vanexCities, setVanexCities] = useState<VanexCity[]>([]);
  const [vanexCityId, setVanexCityId] = useState("");
  const [vanexAreaId, setVanexAreaId] = useState("");

  const isRental = store?.type === "rental";
  const [rentalStart, setRentalStart] = useState("");
  const [rentalEnd, setRentalEnd] = useState("");
  // ceil(ms diff / a day) — must match orders/handler.ts's server-side
  // computation exactly, since this is only a preview; the server never
  // trusts this number, it recomputes the same way from the same two dates.
  const rentalDays =
    isRental && rentalStart && rentalEnd
      ? Math.max(1, Math.ceil((new Date(rentalEnd).getTime() - new Date(rentalStart).getTime()) / 86_400_000))
      : 1;

  const isBooking = store?.type === "booking";
  const [bookingDate, setBookingDate] = useState("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const language = store && isSupportedLanguage(store.language) ? store.language : "ar";
  const { t } = useTranslation(language);

  useEffect(() => {
    if (!isBooking || !bookingDate) {
      setAvailableSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSelectedSlot("");
    api
      .availability(slug, bookingDate)
      .then(({ slots }) => setAvailableSlots(slots))
      .finally(() => setSlotsLoading(false));
  }, [isBooking, slug, bookingDate]);

  // Cart/order details kept around so completeCallback (fired from inside
  // Moamalat's widget, well after the initial submit) can still build the
  // confirmation-page redirect.
  const pendingOrderRef = useRef<{ orderId: string; totalCents: number; shippingCents: number } | null>(null);

  useEffect(() => {
    api.publicStore(slug).then(({ store }) => {
      setStore(store);
      const walletAvailable = Boolean(store.walletProvider && store.dpayAvailable);
      setPaymentMethod(store.codEnabled ? "cod" : walletAvailable ? "wallet" : "cod");
    });
  }, [slug]);

  // "Started checkout" — landing on this page, not the form submit below
  // (that's the order_completed moment instead, fired on the confirmation
  // page once the order actually exists).
  useEffect(() => trackEvent(slug, "checkout_started", `/store/${slug}/checkout`), [slug]);

  useEffect(() => {
    if (!usesVanexPricing) return;
    api.vanexCities().then(({ cities }) => setVanexCities(cities));
  }, [usesVanexPricing]);

  const walletAvailable = Boolean(store?.walletProvider && store?.dpayAvailable);

  const selectedCity = vanexCities.find((c) => c.id === vanexCityId);
  const selectedArea = selectedCity?.areas.find((a) => a.id === vanexAreaId);
  // Area gives the precise rate when picked; otherwise fall back to the
  // city's own flat Vanex rate rather than defaulting to free shipping —
  // a buyer whose exact district isn't in Vanex's list can still check out.
  const shippingCents = usesVanexPricing ? (selectedArea?.priceCents ?? selectedCity?.priceCents ?? 0) : 0;
  const discountCents = appliedCoupon?.discountCents ?? 0;
  // cart.subtotalCents is quantity × the product's own priceCents, which
  // for a rental store IS the daily rate — multiply by the selected
  // number of days for the real total (server recomputes this exact way).
  const effectiveSubtotalCents = isRental ? cart.subtotalCents * rentalDays : cart.subtotalCents;
  const grandTotalCents = effectiveSubtotalCents + shippingCents - discountCents;

  async function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponChecking(true);
    setCouponMessage(null);
    try {
      // For a rental store, cart.subtotalCents is still just the daily
      // rate × quantity — the real subtotal (what the server will
      // actually validate the coupon against) also factors in the
      // selected number of days. Without this, a coupon's minOrderCents
      // check (or its percent/fixed discount estimate) would be computed
      // against the wrong number here, even though the order itself is
      // always created with the correct, server-recomputed total.
      const result = await api.validateCoupon({ storeSlug: slug, code: couponInput.trim(), subtotalCents: effectiveSubtotalCents });
      if (result.valid) {
        setAppliedCoupon({ code: couponInput.trim(), discountCents: result.discountCents });
        setCouponMessage(t("checkout.couponApplied"));
      } else {
        setAppliedCoupon(null);
        setCouponMessage(result.message || t("checkout.couponInvalid"));
      }
    } catch {
      setAppliedCoupon(null);
      setCouponMessage(t("checkout.couponCheckFailed"));
    } finally {
      setCouponChecking(false);
    }
  }

  function goToConfirmation(result: { orderId: string; totalCents: number; shippingCents: number; trackingId?: string; courier?: string; paymentStatus: string }) {
    cart.clear();
    const q = new URLSearchParams({
      orderId: result.orderId,
      totalCents: String(result.totalCents),
      shippingCents: String(result.shippingCents),
      trackingId: result.trackingId ?? "",
      courier: result.courier ?? "",
      paymentStatus: result.paymentStatus,
    });
    router.push(`/store/${slug}/confirmation?${q.toString()}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (cart.lines.length === 0) return;
    if (usesVanexPricing && !selectedCity) {
      setError(t("checkout.selectCity"));
      return;
    }
    if (isRental && (!rentalStart || !rentalEnd)) {
      setError(t("checkout.selectRentalDates"));
      return;
    }
    if (isBooking && !selectedSlot) {
      setError(t("checkout.selectSlot"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await api.createOrder({
        storeSlug: slug,
        items: cart.lines.map((l) =>
          l.bundleId ? { bundleId: l.bundleId, quantity: l.quantity } : { productId: l.productId!, quantity: l.quantity, variantId: l.variantId ?? undefined }
        ),
        buyer: {
          name,
          phone,
          email: email || undefined,
          city: selectedArea ? `${selectedCity?.name} - ${selectedArea.name}` : selectedCity ? selectedCity.name : city,
          address,
          vanexAreaId: selectedArea?.id,
          vanexCityId: selectedCity?.id,
        },
        paymentMethod,
        couponCode: appliedCoupon?.code,
        referralCode: getReferralCode(slug) ?? undefined,
        scheduledStartAt: isRental && rentalStart ? new Date(rentalStart).toISOString() : isBooking ? selectedSlot : undefined,
        scheduledEndAt: isRental && rentalEnd ? new Date(rentalEnd).toISOString() : undefined,
      });

      if (result.moamalat && result.moamalatScriptUrl) {
        pendingOrderRef.current = { orderId: result.orderId, totalCents: result.totalCents, shippingCents: result.shippingCents };
        setWalletPending(true);
        await loadLightboxScript(result.moamalatScriptUrl);
        const lightbox = result.moamalat;
        window.Lightbox!.Checkout.configure = {
          MID: lightbox.MID,
          TID: lightbox.TID,
          AmountTrxn: lightbox.AmountTrxn,
          MerchantReference: lightbox.MerchantReference,
          TrxDateTime: lightbox.TrxDateTime,
          SecureHash: lightbox.SecureHash,
          completeCallback: async (data: Record<string, string>) => {
            try {
              const completeResult = await api.moamalatComplete(data);
              const pending = pendingOrderRef.current;
              if (completeResult.status === "paid" && pending) {
                goToConfirmation({ ...pending, trackingId: completeResult.trackingId, courier: completeResult.courier, paymentStatus: "paid" });
                return;
              }
              setError(completeResult.error ?? t("checkout.paymentConfirmFailed"));
            } catch (err) {
              setError(err instanceof ApiError ? err.message : t("checkout.paymentConfirmFailed"));
            } finally {
              setWalletPending(false);
            }
          },
          errorCallback: () => {
            setError(t("checkout.paymentFailed"));
            setWalletPending(false);
          },
          cancelCallback: () => {
            setWalletPending(false);
          },
        };
        window.Lightbox!.Checkout.showLightbox();
        return;
      }

      goToConfirmation(result);
    } catch (err) {
      // A 404 here specifically means the server couldn't resolve this
      // store by slug at order-creation time — rare, but confusing when it
      // happens (a raw untranslated "Store not found" with no path
      // forward). Re-check via the same public lookup the page itself used
      // on load before concluding the store is really gone: if it still
      // resolves, this was transient (stale data/bundle) and the buyer can
      // just retry; only show the dead-end message if it's genuinely gone.
      if (err instanceof ApiError && err.status === 404) {
        try {
          const fresh = await api.publicStore(slug);
          setStore(fresh.store);
          setError(t("checkout.staleRetry"));
        } catch {
          setStoreGone(true);
        }
      } else {
        setError(err instanceof ApiError ? err.message : t("checkout.orderFailed"));
      }
      setWalletPending(false);
    } finally {
      setLoading(false);
    }
  }

  if (!store) return null;

  const secondary = store.customization?.secondaryColor || "#f0f0f0";

  if (storeGone) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: secondary }}>
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="rounded-2xl bg-white shadow-xl p-8">
            <h1 className="font-display text-2xl font-bold text-harbor">{t("checkout.storeGoneHeading")}</h1>
            <p className="text-rope mt-2">{t("checkout.storeGoneSubtext")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (cart.ready && cart.lines.length === 0) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: secondary }}>
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <div className="rounded-2xl bg-white shadow-xl p-8">
            <h1 className="font-display text-2xl font-bold text-harbor">{t("checkout.emptyCartHeading")}</h1>
            <Link href={`/store/${slug}`} className="text-brass font-bold mt-4 inline-block">
              {t("common.backToStore")}
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: secondary }}>
      <main className="mx-auto max-w-4xl px-6 py-16 grid md:grid-cols-[1.2fr_1fr] gap-8 items-start">
        <div className="rounded-2xl bg-white shadow-xl p-8">
          <h1 className="font-display text-2xl font-extrabold text-harbor mb-6">{t("checkout.heading")}</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.fullName")}</span>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.phone")}</span>
              <input required dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.email")}</span>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder={t("checkout.emailPlaceholder")}
              />
            </label>
            {isRental && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.pickupDate")}</span>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={rentalStart}
                    onChange={(e) => {
                      setRentalStart(e.target.value);
                      if (rentalEnd && rentalEnd <= e.target.value) setRentalEnd("");
                    }}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.returnDate")}</span>
                  <input
                    type="date"
                    required
                    disabled={!rentalStart}
                    min={rentalStart ? addDays(rentalStart, 1) : undefined}
                    value={rentalEnd}
                    onChange={(e) => setRentalEnd(e.target.value)}
                    className="input disabled:opacity-50"
                  />
                </label>
              </div>
            )}
            {isBooking && (
              <div>
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.bookingDate")}</span>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().slice(0, 10)}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="input"
                  />
                </label>
                {bookingDate && (
                  <div className="mt-3">
                    <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.availableTime")}</span>
                    {slotsLoading ? (
                      <p className="text-sm text-rope">{t("checkout.loadingSlots")}</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-rope">{t("checkout.noSlots")}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot) => (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors ${
                              selectedSlot === slot ? "border-signal bg-signal/5 text-signal" : "border-harbor/15 text-harbor hover:border-harbor/25"
                            }`}
                          >
                            {/* Sliced from the ISO string directly, not toLocaleTimeString — see src/lib/booking.ts's module comment on why. */}
                            {slot.slice(11, 16)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {usesVanexPricing ? (
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.city")}</span>
                  <select
                    required
                    value={vanexCityId}
                    onChange={(e) => {
                      setVanexCityId(e.target.value);
                      setVanexAreaId("");
                    }}
                    className="input"
                  >
                    <option value="">{t("checkout.selectCity")}</option>
                    {vanexCities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.areaOptional")}</span>
                  <select
                    disabled={!selectedCity}
                    value={vanexAreaId}
                    onChange={(e) => setVanexAreaId(e.target.value)}
                    className="input disabled:opacity-50"
                  >
                    <option value="">{t("checkout.selectArea")}</option>
                    {selectedCity?.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {formatLYD(a.priceCents, language)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <label className="block">
                <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.city")}</span>
                <input required value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder={t("checkout.cityPlaceholder")} />
              </label>
            )}
            <label className="block">
              <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.address")}</span>
              <textarea
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input"
                rows={3}
              />
            </label>

            {store.type === "physical" && (
              <div>
                <span className="block text-sm font-bold text-harbor mb-1.5">{t("checkout.courier")}</span>
                <p className="rounded-xl border border-harbor/15 bg-canvas px-4 py-3 text-sm text-rope">
                  {courierLabels[store.courier] ?? store.courier}
                </p>
              </div>
            )}

            <div>
              <span className="block text-sm font-bold text-harbor mb-2">{t("checkout.paymentMethod")}</span>
              <div className="space-y-2">
                {store.codEnabled && (
                  <label
                    className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === "cod" ? "border-signal bg-signal/5" : "border-harbor/15 bg-canvas hover:border-harbor/25"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pm"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                      className="accent-signal"
                    />
                    <span className="font-bold text-harbor text-sm">{t("checkout.cod")}</span>
                  </label>
                )}
                {walletAvailable && (
                  <label
                    className={`flex items-center justify-between gap-2 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                      paymentMethod === "wallet" ? "border-signal bg-signal/5" : "border-harbor/15 bg-canvas hover:border-harbor/25"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="pm"
                        checked={paymentMethod === "wallet"}
                        onChange={() => setPaymentMethod("wallet")}
                        className="accent-signal"
                      />
                      <span className="font-bold text-harbor text-sm">{t("checkout.wallet")}</span>
                    </span>
                    {/* width/height must match the real file's aspect ratio
                        (2077x1126, ~1.84:1) — the old 90x30 (3:1) guess gave
                        Next's Image component a wrong aspect-ratio hint that
                        conflicted with w-auto, so browsers disagreed on how
                        to size it (broken on desktop, glitching on mobile). */}
                    <Image src="/payment-logos/moamalat.png" alt="Moamalat" width={177} height={96} className="h-7 w-auto object-contain" />
                  </label>
                )}
              </div>
            </div>
  
            {error && <p className="text-signal text-sm">{error}</p>}
  
            <button
              type="submit"
              disabled={
                loading ||
                walletPending ||
                (usesVanexPricing && !selectedCity) ||
                (isRental && (!rentalStart || !rentalEnd)) ||
                (isBooking && !selectedSlot)
              }
              className="w-full rounded-full bg-signal py-3.5 font-bold text-canvas shadow-lg shadow-signal/20 hover:bg-signal-dark hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0"
            >
              {loading || walletPending ? t("checkout.confirming") : t("checkout.confirmOrder", { total: formatLYD(grandTotalCents, language) })}
            </button>
          </form>
        </div>

        <aside className="rounded-2xl bg-white shadow-xl p-6 h-fit">
          <h2 className="font-display font-bold text-harbor mb-4">{t("checkout.orderSummary")}</h2>
          <ul className="space-y-3 text-sm">
            {cart.lines.map((line) => (
              <li key={line.productId ?? line.bundleId} className="flex justify-between text-harbor/90">
                <span>
                  {line.name} × {line.quantity}
                  {isRental && rentalDays > 1 ? t("checkout.rentalDaySuffix", { days: rentalDays }) : ""}
                </span>
                <span>{formatLYD(line.priceCents * line.quantity * (isRental ? rentalDays : 1), language)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 pt-4 border-t border-harbor/10">
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                className="input flex-1"
                dir="ltr"
                placeholder={t("checkout.couponPlaceholder")}
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={couponChecking || !couponInput.trim()}
                className="rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 disabled:opacity-50"
              >
                {couponChecking ? "..." : t("checkout.apply")}
              </button>
            </div>
            {couponMessage && (
              <p className={`mt-2 text-xs ${appliedCoupon ? "text-green-700" : "text-signal"}`}>{couponMessage}</p>
            )}
          </div>

          {usesVanexPricing && (
            <div className="flex justify-between text-sm mt-3 pt-3 border-t border-harbor/10 text-harbor/90">
              <span>{t("checkout.shipping")}</span>
              <span>{selectedCity ? formatLYD(shippingCents, language) : t("common.dash")}</span>
            </div>
          )}
          {discountCents > 0 && (
            <div className="flex justify-between text-sm mt-3 text-green-700">
              <span>{t("checkout.discount")}</span>
              <span>-{formatLYD(discountCents, language)}</span>
            </div>
          )}
          <div className="border-t border-harbor/10 mt-4 pt-4 flex justify-between font-bold text-harbor text-lg">
            <span>{t("common.total")}</span>
            <span>{formatLYD(grandTotalCents, language)}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
