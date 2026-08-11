import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/vanex/cities — public: zones + areas with shipping prices, for
// the checkout page's city/area picker on vanex-courier stores.
export async function GET() {
  const cities = await prisma.vanexCity.findMany({
    orderBy: { name: "asc" },
    include: { areas: { orderBy: { name: "asc" } } },
  });
  return NextResponse.json({ cities });
}
