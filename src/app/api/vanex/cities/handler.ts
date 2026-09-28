import { NextResponse } from "next/server";

type AreaRow = { id: string; name: string; priceCents: number };
type CityRow = { id: string; name: string; areas: AreaRow[] };

export type VanexCitiesDb = {
  vanexCity: { findMany: (args: { orderBy: { name: "asc" }; include: { areas: { orderBy: { name: "asc" } } } }) => Promise<CityRow[]> };
};

// GET /api/vanex/cities — public: zones + areas with shipping prices, for
// the checkout page's city/area picker on vanex-courier stores.
export async function handleVanexCities(db: VanexCitiesDb): Promise<Response> {
  const cities = await db.vanexCity.findMany({
    orderBy: { name: "asc" },
    include: { areas: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ cities });
}
