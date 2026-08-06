import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.template.findMany({
      where: { active: true },
      orderBy: [{ featured: "desc" }, { usageCount: "desc" }],
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        description: true,
        descriptionAr: true,
        price: true,
        billingType: true,
        thumbnail: true,
        previewUrl: true,
        features: true,
        usageCount: true,
        rating: true,
        reviews: true,
        isNew: true,
        featured: true,
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
