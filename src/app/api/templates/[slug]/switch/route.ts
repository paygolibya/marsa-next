import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    // The segment is shared with GET /api/templates/[slug], so it may carry
    // either a template id or a slug depending on the caller.
    const { slug } = await params;
    const { storeId } = await req.json();

    const template = await prisma.template.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: { templateId: template.id },
      include: { template: true },
    });

    await prisma.templateCustomization.upsert({
      where: { storeId },
      create: {
        storeId,
        templateId: template.id,
      },
      update: {
        templateId: template.id,
      },
    });

    return NextResponse.json({ success: true, store: updatedStore });
  } catch (error) {
    console.error("Error switching template:", error);
    return NextResponse.json({ error: "Failed to switch template" }, { status: 500 });
  }
}
