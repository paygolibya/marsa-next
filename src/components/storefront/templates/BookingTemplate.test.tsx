import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import BookingTemplate from "./BookingTemplate";
import { makeTestStore, baseTemplateProps } from "./test-fixtures";
import type { Product } from "@/lib/api";
import type { SectionData } from "@/components/storefront/sections/types";

const PRODUCT: Product = {
  id: "p1",
  storeId: "store-1",
  name: "قص شعر",
  description: null,
  categoryId: null,
  priceCents: 5000,
  imageUrl: null,
  images: [],
  variantOptions: null,
  variants: [],
  active: true,
  createdAt: new Date().toISOString(),
  trackInventory: false,
  stockQty: 0,
  lowStockThreshold: 0,
  metaTitle: null,
  metaDescription: null,
  costPriceCents: null,
};

const PRODUCTS_SECTION: SectionData = { id: "s1", type: "products", position: 0, enabled: true, settings: {} };

function render(overrides: { bookingSlotMinutes?: number | null } = {}) {
  const store = { ...makeTestStore(), type: "booking" as const, bookingSlotMinutes: overrides.bookingSlotMinutes ?? null };
  return renderToStaticMarkup(
    <BookingTemplate {...baseTemplateProps} store={store} products={[PRODUCT]} filtered={[PRODUCT]} sections={[PRODUCTS_SECTION]} />
  );
}

test("renders the booking CTA, never the generic add-to-cart one", () => {
  const html = render();
  assert.match(html, /احجز الآن/);
  assert.doesNotMatch(html, /أضف إلى السلة/);
});

test("shows a duration badge when the store has bookingSlotMinutes set", () => {
  const withDuration = render({ bookingSlotMinutes: 45 });
  const without = render({ bookingSlotMinutes: null });
  assert.match(withDuration, /45 دقيقة/);
  assert.doesNotMatch(without, /دقيقة/);
});

test("the header cart button is labeled for bookings, not a generic cart", () => {
  const html = render();
  assert.match(html, /حجوزاتي/);
});

test("the hero falls back to booking-specific copy when the store has no custom tagline", () => {
  const store = { ...makeTestStore(), type: "booking" as const, bookingSlotMinutes: null };
  store.customization = { ...store.customization!, tagline: null, description: null };
  const html = renderToStaticMarkup(<BookingTemplate {...baseTemplateProps} store={store} products={[]} filtered={[]} sections={[]} />);
  assert.match(html, /احجز موعدك الآن/);
});
