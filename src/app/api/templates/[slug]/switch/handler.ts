import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

export type SwitchTemplateDb = {
  template: {
    findFirst: (args: { where: { OR: ({ id: string } | { slug: string })[] }; select: { id: true } }) => Promise<{ id: string } | null>;
  };
  store: {
    findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null>;
    update: (args: { where: { id: string }; data: { templateId: string }; include: { template: true } }) => Promise<unknown>;
  };
  templateCustomization: {
    upsert: (args: { where: { storeId: string }; create: { storeId: string; templateId: string }; update: { templateId: string } }) => Promise<unknown>;
  };
};

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
export async function handleSwitchTemplate(db: SwitchTemplateDb, req: Request, slug: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { storeId } = await req.json();

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const template = await db.template.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updatedStore = await db.store.update({
      where: { id: storeId },
      data: { templateId: template.id },
      include: { template: true },
    });

    await db.templateCustomization.upsert({
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
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to switch template" }, { status: 500 });
  }
}
