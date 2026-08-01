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

async function createSabilShipment(order: ShipmentOrder): Promise<ShipmentResult> {
  const apiKey = process.env.DAREEB_SABIL_API_KEY?.trim();
  const apiBase = process.env.DAREEB_SABIL_API_BASE?.trim() || "https://v2.sabil.ly";
  const accountId = process.env.DAREEB_SABIL_ACCOUNT_ID?.trim() || "6959a49d972d3cf3e9863704";
  const serviceId = process.env.DAREEB_SABIL_SERVICE_ID?.trim();
  const contactId = process.env.DAREEB_SABIL_CONTACT_ID?.trim();

  if (!apiKey || !serviceId || !contactId) {
    return mockCreateShipment("sabil", order);
  }

  try {
    const response = await fetch(`${apiBase}/api/local/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `apikey ${apiKey}`,
        "X-API-VERSION": "1.0.0",
        "X-ACCOUNT-ID": accountId,
      },
      body: JSON.stringify({
        service: serviceId,
        contacts: [contactId],
        paymentBy: "receiver",
        to: {
          countryCode: "LBY",
          city: order.buyer.city || "Tripoli",
          area: order.buyer.city || "Tripoli",
          address: order.buyer.address || "Unknown address",
        },
        products: [
          {
            title: `Order ${order.id}`,
            quantity: 1,
            amount: Math.max(1, Math.round(order.totalCents / 100)),
            currency: "LYD",
            isChargeable: true,
          },
        ],
        notes: `Order ${order.id} for ${order.buyer.name}`,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Darb Assabil API error ${response.status}: ${responseText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const reference = (data?.data as { reference?: string } | undefined)?.reference;
    const id = (data?.data as { _id?: string } | undefined)?._id;

    return {
      trackingId: reference || id || `${"sabil".toUpperCase()}-${nanoid(8)}`,
      raw: data,
    };
  } catch (error) {
    console.error("Darb Assabil shipment creation failed:", error);
    return mockCreateShipment("sabil", order);
  }
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
    return createSabilShipment(order);
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
