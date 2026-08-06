import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      primaryColor,
      secondaryColor,
      accentColor,
      logo,
      favicon,
      tagline,
      description,
      headerStyle,
      footerStyle,
      showNewsletter,
      showReviews,
      showTestimonials,
      showSocialProof,
    } = body;

    const customization = await prisma.templateCustomization.upsert({
      where: { storeId: id },
      create: {
        storeId: id,
        templateId: null,
        primaryColor: primaryColor || "#0066cc",
        secondaryColor: secondaryColor || "#f0f0f0",
        accentColor,
        logo,
        favicon,
        tagline,
        description,
        headerStyle: headerStyle || "standard",
        footerStyle: footerStyle || "standard",
        showNewsletter: showNewsletter !== false,
        showReviews: showReviews !== false,
        showTestimonials: showTestimonials === true,
        showSocialProof: showSocialProof !== false,
      },
      update: {
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
        accentColor,
        logo,
        favicon,
        tagline,
        description,
        headerStyle: headerStyle || undefined,
        footerStyle: footerStyle || undefined,
        showNewsletter: showNewsletter !== undefined ? showNewsletter : undefined,
        showReviews: showReviews !== undefined ? showReviews : undefined,
        showTestimonials: showTestimonials !== undefined ? showTestimonials : undefined,
        showSocialProof: showSocialProof !== undefined ? showSocialProof : undefined,
      },
    });

    return NextResponse.json({ success: true, customization });
  } catch (error) {
    console.error("Error updating customization:", error);
    return NextResponse.json({ error: "Failed to update customization" }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const customization = await prisma.templateCustomization.findUnique({
      where: { storeId: id },
      include: { template: true },
    });

    if (!customization) {
      return NextResponse.json({ error: "Customization not found" }, { status: 404 });
    }

    return NextResponse.json({ customization });
  } catch (error) {
    console.error("Error fetching customization:", error);
    return NextResponse.json({ error: "Failed to fetch customization" }, { status: 500 });
  }
}
