import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { normalizeSectionOrder } from "@/components/storefront/templates/types";
import { parseSectionsPayload } from "@/components/storefront/sections/schemas";
import { normalizeToSections } from "@/components/storefront/sections/normalize";
import { validateCustomizationEnums } from "./validate";

// The exact slice of the Prisma client these two handlers touch — injected
// so tests can supply a fake and verify the route calls it correctly
// (right ownership filter, right upsert create/update field mapping —
// the showX !== false / !== undefined distinction is easy to get backwards
// — right response shape) without a real database. route.ts's GET/POST are
// the only things Next.js itself calls; they forward here with the real
// `prisma`. (Not in route.ts itself — Next's route-file export validation
// only allows known handler names, and rejects any other export.)
export type CustomizeDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  templateCustomization: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- args
    // deliberately untyped (not the exact { where, create, update } shape)
    // so the real PrismaClient's much more specific upsert signature
    // structurally satisfies this interface (TS function-parameter
    // contravariance rejects even `unknown` here). The actual create/
    // update field mapping is verified at runtime by the fake's own
    // assertions in the tests, not by this type.
    upsert: (args: any) => Promise<Record<string, unknown>>;
    findUnique: (args: { where: { storeId: string }; include: { template: true } }) => Promise<Record<string, unknown> | null>;
  };
  storeSection: {
    deleteMany: (args: { where: { storeId: string } }) => Promise<unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same
    // reason as templateCustomization.upsert above.
    createManyAndReturn: (args: any) => Promise<unknown[]>;
    findMany: (args: { where: { storeId: string } }) => Promise<
      { id: string; type: string; position: number; enabled: boolean; settings: unknown }[]
    >;
  };
  $transaction: <T>(ops: Promise<T>[]) => Promise<T[]>;
};

export async function handleCustomizePost(db: CustomizeDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
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
      showLogo,
      showStoreName,
      logoSize,
      textColor,
      textSize,
      coverImage,
      coverImageSize,
      heroEnabled,
      heroSize,
      cartPosition,
      showNewsletter,
      showReviews,
      showTestimonials,
      showSocialProof,
      sectionOrder,
      sections,
    } = body;
    const normalizedSectionOrder = sectionOrder !== undefined ? normalizeSectionOrder(sectionOrder) : undefined;
    const { validLogoSize, validTextSize, validCoverImageSize, validHeroSize, validCartPosition } = validateCustomizationEnums({
      logoSize,
      textSize,
      coverImageSize,
      heroSize,
      cartPosition,
    });

    const customization = await db.templateCustomization.upsert({
      where: { storeId },
      create: {
        storeId,
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
        showLogo: showLogo !== false,
        showStoreName: showStoreName !== false,
        logoSize: validLogoSize ?? "md",
        textColor,
        textSize: validTextSize ?? "md",
        coverImage,
        coverImageSize: validCoverImageSize ?? "md",
        heroEnabled: heroEnabled !== false,
        heroSize: validHeroSize ?? "md",
        cartPosition: validCartPosition ?? "left",
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
        showLogo: showLogo !== undefined ? showLogo : undefined,
        showStoreName: showStoreName !== undefined ? showStoreName : undefined,
        logoSize: validLogoSize,
        textColor,
        textSize: validTextSize,
        coverImage,
        coverImageSize: validCoverImageSize,
        heroEnabled: heroEnabled !== undefined ? heroEnabled : undefined,
        heroSize: validHeroSize,
        cartPosition: validCartPosition,
        showNewsletter: showNewsletter !== undefined ? showNewsletter : undefined,
        showReviews: showReviews !== undefined ? showReviews : undefined,
        showTestimonials: showTestimonials !== undefined ? showTestimonials : undefined,
        showSocialProof: showSocialProof !== undefined ? showSocialProof : undefined,
        sectionOrder: normalizedSectionOrder,
      },
    });

    let savedSections = null;
    if (sections !== undefined) {
      const parsed = parseSectionsPayload(sections);
      const [, created] = await db.$transaction([
        db.storeSection.deleteMany({ where: { storeId } }),
        db.storeSection.createManyAndReturn({
          data: parsed.map((s, position) => ({ storeId, type: s.type, position, enabled: s.enabled, settings: s.settings as object })),
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

export async function handleCustomizeGet(db: CustomizeDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const customization = await db.templateCustomization.findUnique({ where: { storeId }, include: { template: true } });
    if (!customization) return NextResponse.json({ error: "Customization not found" }, { status: 404 });

    const storedSections = await db.storeSection.findMany({ where: { storeId } });
    const sections = normalizeToSections(storedSections, {
      sectionOrder: customization.sectionOrder as string[] | null | undefined,
      showSocialProof: customization.showSocialProof as boolean,
      showTestimonials: customization.showTestimonials as boolean,
      showNewsletter: customization.showNewsletter as boolean,
    });

    return NextResponse.json({ customization, sections });
  } catch (error) {
    console.error("Error fetching customization:", error);
    return NextResponse.json({ error: "Failed to fetch customization" }, { status: 500 });
  }
}
