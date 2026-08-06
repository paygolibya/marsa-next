import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { storeId } = await req.json();

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { templateId: id },
      include: { template: true },
    });

    await prisma.templateCustomization.upsert({
      where: { storeId },
      create: {
        storeId,
        templateId: id,
      },
      update: {
        templateId: id,
      },
    });

    return NextResponse.json({ success: true, store: updatedStore });
  } catch (error) {
    console.error("Error switching template:", error);
    return NextResponse.json({ error: "Failed to switch template" }, { status: 500 });
  }
}
