// Vanex domain functions: cities/pricing sync, shipment creation/tracking,
// pickup requests. Pure API + DB-sync logic — does NOT touch Order rows;
// that stays owned by src/app/api/orders/route.ts, same as every other
// courier in src/lib/integrations/couriers.ts.

import { prisma } from "@/lib/prisma";
import { vanexRequest } from "./vanex-client";

type VanexLocationApi = { id: number; name: string; parent_city: number; price: number; code: string };
type VanexCityApi = { id: number; name: string; price: number; code: string; branch: number; locations: VanexLocationApi[] };

export async function syncVanexCities(): Promise<{ cities: number; areas: number }> {
  const body = await vanexRequest("/city/all");
  const cities = (body.data as VanexCityApi[] | undefined) ?? [];

  let areaCount = 0;
  for (const city of cities) {
    const row = await prisma.vanexCity.upsert({
      where: { vanexId: city.id },
      create: {
        vanexId: city.id,
        name: city.name,
        priceCents: Math.round(city.price * 100),
        code: city.code,
        branch: city.branch,
      },
      update: {
        name: city.name,
        priceCents: Math.round(city.price * 100),
        code: city.code,
        branch: city.branch,
      },
    });

    for (const location of city.locations || []) {
      await prisma.vanexArea.upsert({
        where: { vanexId: location.id },
        create: {
          vanexId: location.id,
          cityId: row.id,
          name: location.name,
          priceCents: Math.round(location.price * 100),
          code: location.code,
        },
        update: {
          cityId: row.id,
          name: location.name,
          priceCents: Math.round(location.price * 100),
          code: location.code,
        },
      });
      areaCount++;
    }
  }

  return { cities: cities.length, areas: areaCount };
}

export type VanexShipmentInput = {
  customerName: string;
  customerPhone: string;
  cityId: number;
  subCityId?: number;
  address: string;
  itemsCount: number;
  totalCents: number;
  /** Cash-on-delivery amount to collect from the recipient, in cents. */
  codAmountCents: number;
  description: string;
  notes?: string;
};

export type VanexShipmentResult = { waybillCode: string; raw: unknown };

// POST /customer/package takes a JSON body (per Vanex's OpenAPI spec at
// docs.vanex.ly) — NOT multipart/form-data. "reciever"/"leangh"/
// "payment_methode" are spelled that way in the real API, not typos here.
// "products" must be sent as [] even for a normal (non-safe-storage)
// shipment — it's in the API's required-fields list.
export async function createVanexShipment(input: VanexShipmentInput): Promise<VanexShipmentResult> {
  const body = await vanexRequest("/customer/package", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reciever: input.customerName,
      phone: input.customerPhone,
      city: input.cityId,
      address_child: input.subCityId,
      address: input.address,
      packageDetailsType: 1,
      qty: input.itemsCount,
      price: Math.round(input.totalCents / 100),
      total_amount: Math.round(input.codAmountCents / 100),
      description: input.description,
      sticker_notes: input.notes,
      leangh: "35",
      width: "35",
      height: "35",
      payment_methode: "cash",
      // Not documented in Vanex's published OpenAPI spec, but required by
      // the live API — 1 = LYD, the only currency this platform trades in.
      currency_type_id: 1,
      paid_by: "customer",
      commission_by: "customer",
      extra_size_by: "customer",
      is_online_payable: 0,
      inspection_allowed: 1,
      measuring_is_allowed: 0,
      heat_intolerance: 0,
      casing: 0,
      partial_delivery: 0,
      breakable: false,
      insurance: false,
      products: [],
    }),
  });

  // The published OpenAPI spec claims this comes back as `id`, but the live
  // API actually returns `package_code` (confirmed against the real API) —
  // trust the live behavior over the docs.
  const waybillCode = body.package_code as string | undefined;
  if (!waybillCode) {
    throw new Error("Vanex shipment creation did not return a package_code");
  }
  return { waybillCode, raw: body };
}

export async function trackVanexShipment(waybillCode: string) {
  const body = await vanexRequest(`/customer/package/${encodeURIComponent(waybillCode)}`);
  return body.data;
}

export type VanexPickupInput = {
  phone: string;
  backupPhone?: string;
  numberOfPackages: number;
  address: string;
  /** Google Maps link for the pickup location — not in Vanex's published
   * docs, but required by the live API (validated as a URL). */
  mapUrl: string;
  notes?: string;
  services?: {
    settlement?: boolean;
    returns?: boolean;
    ready?: boolean;
    packaging?: boolean;
    hasProducts?: boolean;
  };
};

export async function requestVanexPickup(input: VanexPickupInput) {
  const body = await vanexRequest("/customer/collects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: input.phone,
      phone_2: input.backupPhone || input.phone,
      num_pkg: input.numberOfPackages,
      address: input.address,
      map: input.mapUrl,
      notes: input.notes || "",
      services: {
        sett: input.services?.settlement ? 1 : 0,
        returns_request: input.services?.returns ? 1 : 0,
        ready: input.services?.ready ? 1 : 0,
        packaging: input.services?.packaging ? 1 : 0,
        has_products: input.services?.hasProducts ? 1 : 0,
      },
    }),
  });
  return body.data;
}

export async function listVanexPickups(status: 1 | 2 | 3 = 1) {
  const body = await vanexRequest(`/customer/collects/status?status=${status}`);
  return body.data;
}

export async function cancelVanexPickup(collectId: number): Promise<true> {
  await vanexRequest(`/customer/collects/${collectId}`, { method: "DELETE" });
  return true;
}
