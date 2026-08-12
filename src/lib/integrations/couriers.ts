import { nanoid } from "nanoid";
import { createVanexShipment } from "./vanex";

/**
 * Every courier module must resolve to { trackingId, raw }.
 *
 * Vanex is the only real integration right now. Sabil and Shaheen were
 * pulled out deliberately — re-add them the same way Vanex was built,
 * against their real API contracts, not guessed at.
 */

export type ShipmentOrder = {
  id: string;
  buyer: { name: string; phone: string; city: string; address: string };
  totalCents: number;
  paymentMethod: "cod" | "wallet";
  itemsCount?: number;
  // Present only for vanex orders that went through the city/area picker —
  // lets the real Vanex integration resolve the destination without the
  // rest of the app needing to know Vanex's numeric city/area ids.
  vanex?: { cityId: number; subCityId?: number };
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

async function createVanexShipmentForOrder(order: ShipmentOrder): Promise<ShipmentResult> {
  const email = process.env.VANEX_EMAIL?.trim();
  const password = process.env.VANEX_PASSWORD?.trim();
  // No credentials, or the order never went through the vanex city/area
  // picker (so we don't know a destination) — fall back to the mock rather
  // than fail the whole checkout.
  if (!email || !password || !order.vanex) {
    return mockCreateShipment("vanex", order);
  }

  try {
    const result = await createVanexShipment({
      customerName: order.buyer.name,
      customerPhone: order.buyer.phone,
      cityId: order.vanex.cityId,
      subCityId: order.vanex.subCityId,
      address: order.buyer.address || "Unknown address",
      itemsCount: order.itemsCount ?? 1,
      totalCents: order.totalCents,
      // COD orders collect the full amount on delivery; wallet orders are
      // already paid, so there's nothing left for the courier to collect.
      codAmountCents: order.paymentMethod === "cod" ? order.totalCents : 0,
      description: `Order ${order.id}`,
      notes: `Rifqa Order ${order.id}`,
    });
    return { trackingId: result.waybillCode, raw: result.raw as Record<string, unknown> };
  } catch (error) {
    console.error("Vanex shipment creation failed:", error);
    return mockCreateShipment("vanex", order);
  }
}

const couriers: Record<string, (order: ShipmentOrder) => Promise<ShipmentResult>> = {
  vanex: createVanexShipmentForOrder,
};

export async function createShipment(courierName: string, order: ShipmentOrder): Promise<ShipmentResult> {
  const courier = couriers[courierName];
  if (!courier) throw new Error(`Unknown courier: ${courierName}`);
  return courier(order);
}
