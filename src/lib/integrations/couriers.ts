import { nanoid } from "nanoid";

/**
 * Every courier module must resolve to { trackingId, raw }.
 *
 * Until real API keys/agreements exist for Vanex, Dareeb Sabil, or Shaheen,
 * each one falls back to a mock that behaves like a real integration would —
 * so the rest of the order flow (statuses, webhooks, dashboard) can be built
 * and tested now, and swapped for a real HTTP call later without touching
 * anything else in the codebase. This mirrors the original
 * marsa-backend/src/integrations/couriers/index.js exactly.
 */

export type ShipmentOrder = {
  id: string;
  buyer: { name: string; phone: string; city: string; address: string };
  totalCents: number;
};

export type ShipmentResult = {
  trackingId: string;
  raw: Record<string, unknown>;
};

async function mockCreateShipment(courierName: string, order: ShipmentOrder): Promise<ShipmentResult> {
  // Simulates network latency so the rest of the app handles it realistically.
  await new Promise((r) => setTimeout(r, 150));
  return {
    trackingId: `${courierName.toUpperCase()}-${nanoid(8)}`,
    raw: { mock: true, courier: courierName, orderId: order.id },
  };
}

const couriers: Record<string, (order: ShipmentOrder) => Promise<ShipmentResult>> = {
  vanex: async (order) => {
    if (!process.env.VANEX_API_KEY) return mockCreateShipment("vanex", order);
    // TODO: replace with a real call once you have Vanex API credentials, e.g.:
    // const res = await fetch(`${process.env.VANEX_API_BASE}/shipments`, {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${process.env.VANEX_API_KEY}` },
    //   body: JSON.stringify({ ...order }),
    // });
    // return await res.json();
    return mockCreateShipment("vanex", order);
  },
  sabil: async (order) => {
    if (!process.env.DAREEB_SABIL_API_KEY) return mockCreateShipment("sabil", order);
    return mockCreateShipment("sabil", order); // same pattern as above once you have real creds
  },
  shaheen: async (order) => {
    if (!process.env.SHAHEEN_API_KEY) return mockCreateShipment("shaheen", order);
    return mockCreateShipment("shaheen", order);
  },
};

export async function createShipment(courierName: string, order: ShipmentOrder): Promise<ShipmentResult> {
  const courier = couriers[courierName];
  if (!courier) throw new Error(`Unknown courier: ${courierName}`);
  return courier(order);
}
