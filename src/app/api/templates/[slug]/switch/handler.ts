import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { MalformedJsonError, malformedJsonResponse, readJsonBody } from "@/lib/http/read-json";

type TemplateColors = { primaryColor?: string; secondaryColor?: string };

export type SwitchTemplateDb = {
  template: {
    findFirst: (args: {
      where: { OR: ({ id: string } | { slug: string })[] };
      select: { id: true; defaultColors: true };
    }) => Promise<{ id: string; defaultColors: unknown } | null>;
  };
  store: {
    findFirst: (args: {
      where: { id: string; merchantId: string };
      select: {
        id: true;
        template: { select: { defaultColors: true } };
        customization: { select: { primaryColor: true; secondaryColor: true } };
      };
    }) => Promise<{
      id: string;
      template: { defaultColors: unknown } | null;
      customization: { primaryColor: string; secondaryColor: string } | null;
    } | null>;
    update: (args: { where: { id: string }; data: { templateId: string }; include: { template: true } }) => Promise<unknown>;
  };
  templateCustomization: {
    upsert: (args: {
      where: { storeId: string };
      create: { storeId: string; templateId: string; primaryColor?: string; secondaryColor?: string };
      update: { templateId: string; primaryColor?: string; secondaryColor?: string };
    }) => Promise<unknown>;
  };
};

function asColors(value: unknown): TemplateColors {
  return value && typeof value === "object" ? (value as TemplateColors) : {};
}

function sameColor(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
}

// POST /api/templates/:slug/switch — { storeId }. The segment is shared
// with GET /api/templates/[slug], so it may carry either a template id or
// a slug depending on the caller.
//
// Auth + ownership check added here (was previously missing entirely —
// this route accepted any storeId from an unauthenticated caller and
// switched that store's template with no check it belonged to them at
// all; TemplateSwitcher.tsx, the only caller, never sent an Authorization
// header). Every other store-mutating route in this app enforces
// ownership the same way (see stores/[id]/handler.ts); this one silently
// didn't, found while porting it to DI.
//
// Colors: switching used to keep the old template's palette, so picking
// e.g. Sport after Luxury rendered Sport in Luxury's black/gold. The new
// template's defaultColors are now applied — but only when the store's
// current colors are still the old template's untouched defaults (or it
// has no customization yet). A merchant who set their own brand colors
// keeps them.
export async function handleSwitchTemplate(db: SwitchTemplateDb, req: Request, slug: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { storeId } = await readJsonBody(req);

    const store = await db.store.findFirst({
      where: { id: storeId, merchantId },
      select: {
        id: true,
        template: { select: { defaultColors: true } },
        customization: { select: { primaryColor: true, secondaryColor: true } },
      },
    });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const template = await db.template.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      select: { id: true, defaultColors: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const oldDefaults = asColors(store.template?.defaultColors);
    const current = store.customization;
    const colorsUntouched =
      !current ||
      (sameColor(current.primaryColor, oldDefaults.primaryColor) && sameColor(current.secondaryColor, oldDefaults.secondaryColor));

    const newDefaults = asColors(template.defaultColors);
    const colors: TemplateColors = {};
    if (colorsUntouched) {
      if (newDefaults.primaryColor) colors.primaryColor = newDefaults.primaryColor;
      if (newDefaults.secondaryColor) colors.secondaryColor = newDefaults.secondaryColor;
    }

    const updatedStore = await db.store.update({
      where: { id: storeId },
      data: { templateId: template.id },
      include: { template: true },
    });

    await db.templateCustomization.upsert({
      where: { storeId },
      create: { storeId, templateId: template.id, ...colors },
      update: { templateId: template.id, ...colors },
    });

    return NextResponse.json({ success: true, store: updatedStore });
  } catch (error) {
    if (error instanceof MalformedJsonError) return malformedJsonResponse();
    console.error("Error switching template:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to switch template" }, { status: 500 });
  }
}
