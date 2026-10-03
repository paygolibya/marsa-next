import test from "node:test";
import assert from "node:assert/strict";
import { handleTrackOrder, type TrackOrderDeps } from "./handler";

function req(params: Record<string, string>) {
  const url = new URL("http://localhost/api/orders/track");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url);
}

const fullOrder = {
  status: "shipped",
  courierStatus: "in_transit",
  courierStatusAt: new Date(),
  courierNote: null,
  courierTrackingId: "TRACK-1",
  totalCents: 10000,
  shippingCents: 1500,
  createdAt: new Date(),
  scheduledStartAt: null,
  scheduledEndAt: null,
  items: [{ id: "i1", productId: "p1", productName: "Widget", unitPriceCents: 8500, quantity: 1, variantLabel: null }],
  // Fields that must NEVER appear in the response — the whole point of
  // this endpoint being a restricted view, not the full order row.
  buyerName: "Real Buyer Name",
  buyerPhone: "0912345678",
  buyerAddress: "123 Secret Street",
  buyerEmail: "buyer@example.com",
};

test("requires both orderId and phone — missing either returns 400", async () => {
  const deps: TrackOrderDeps = { verifyBuyerOrder: async () => fullOrder as any };
  const res1 = await handleTrackOrder(deps, req({ phone: "0912345678" }));
  assert.equal(res1.status, 400);
  const res2 = await handleTrackOrder(deps, req({ orderId: "order-1" }));
  assert.equal(res2.status, 400);
});

test("a non-matching orderId/phone pair returns 404 — the real security boundary, not just a lookup miss", async () => {
  const deps: TrackOrderDeps = { verifyBuyerOrder: async () => null };
  const res = await handleTrackOrder(deps, req({ orderId: "order-1", phone: "0999999999" }));
  assert.equal(res.status, 404);
});

test("a matching order returns only the restricted field set — buyer PII never leaks into the response", async () => {
  const deps: TrackOrderDeps = { verifyBuyerOrder: async () => fullOrder as any };
  const res = await handleTrackOrder(deps, req({ orderId: "order-1", phone: "0912345678" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "shipped");
  assert.equal(body.courierTrackingId, "TRACK-1");
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].productName, "Widget");

  // The actual security-relevant assertion: none of these keys exist.
  assert.equal(body.buyerName, undefined);
  assert.equal(body.buyerPhone, undefined);
  assert.equal(body.buyerAddress, undefined);
  assert.equal(body.buyerEmail, undefined);
  assert.deepEqual(
    Object.keys(body).sort(),
    [
      "courierNote",
      "courierStatus",
      "courierStatusAt",
      "courierTrackingId",
      "createdAt",
      "items",
      "scheduledStartAt",
      "scheduledEndAt",
      "shippingCents",
      "status",
      "totalCents",
    ].sort()
  );
});

test("a rental order's pickup/return dates pass through to the buyer-facing response", async () => {
  const start = new Date("2026-11-01T00:00:00.000Z");
  const end = new Date("2026-11-04T00:00:00.000Z");
  const deps: TrackOrderDeps = { verifyBuyerOrder: async () => ({ ...fullOrder, scheduledStartAt: start, scheduledEndAt: end }) as any };
  const res = await handleTrackOrder(deps, req({ orderId: "order-1", phone: "0912345678" }));
  const body = await res.json();
  assert.equal(new Date(body.scheduledStartAt).getTime(), start.getTime());
  assert.equal(new Date(body.scheduledEndAt).getTime(), end.getTime());
});
