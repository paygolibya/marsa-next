import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { normalizeSectionOrder } from "@/components/storefront/templates/types";
import { parseSectionsPayload } from "@/components/storefront/sections/schemas";
import { normalizeToSections } from "@/components/storefront/sections/normalize";

// POST /api/stores/:id/customize — needs auth + ownership. Previously had
// NO auth check at all (anyone who guessed/knew a store id could overwrite
// its branding) — fixed here while extending this route for sections
// persistence, matching the getAuthMerchantId + ownership pattern every
// other store-mutating route already uses (see PATCH /api/stores/[id]).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    const store = await prisma.store.findFirst({ where: { id, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

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
      sectionOrder,
      sections,
    } = body;
    // Always normalized before saving — never trust the client to send a
    // complete/valid permutation of the known section keys. (Legacy path —
    // new code sends `sections` instead, see below.)
    const normalizedSectionOrder = sectionOrder !== undefined ? normalizeSectionOrder(sectionOrder) : undefined;

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
        sectionOrder: normalizedSectionOrder ?? undefined,
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
        sectionOrder: normalizedSectionOrder,
      },
    });

    // The real, current save path (see src/components/editor) — a
    // transactional full replace, not a per-row upsert, since the editor
    // always sends the complete ordered list and a section can be
    // added/removed/reordered freely between saves.
    let savedSections = null;
    if (sections !== undefined) {
      const parsed = parseSectionsPayload(sections);
      const [, created] = await prisma.$transaction([
        prisma.storeSection.deleteMany({ where: { storeId: id } }),
        prisma.storeSection.createManyAndReturn({
          data: parsed.map((s, position) => ({ storeId: id, type: s.type, position, enabled: s.enabled, settings: s.settings as object })),
        }),
      ]);
      savedSections = created;
    }

    return NextResponse.json({ success: true, customization, sections: savedSections });
  } catch (error) {
    console.error("Error updating customization:", error);
    return NextResponse.json({ error: "Failed to update customization" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    const store = await prisma.store.findFirst({ where: { id, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const customization = await prisma.templateCustomization.findUnique({
      where: { storeId: id },
      include: { template: true },
    });

    if (!customization) {
      return NextResponse.json({ error: "Customization not found" }, { status: 404 });
    }

    const storedSections = await prisma.storeSection.findMany({ where: { storeId: id } });
    const sections = normalizeToSections(storedSections, {
      sectionOrder: customization.sectionOrder,
      showSocialProof: customization.showSocialProof,
      showTestimonials: customization.showTestimonials,
      showNewsletter: customization.showNewsletter,
    });

    return NextResponse.json({ customization, sections });
  } catch (error) {
    console.error("Error fetching customization:", error);
    return NextResponse.json({ error: "Failed to fetch customization" }, { status: 500 });
  }
}
