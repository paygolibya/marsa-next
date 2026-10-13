import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

type TemplateRow = {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  descriptionAr: string;
  price: number;
  billingType: string;
  thumbnail: string;
  previewUrl: string | null;
  features: unknown;
  usageCount: number;
  rating: number;
  reviews: number;
  isNew: boolean;
  featured: boolean;
  storeTypes: string[];
  industries: string[];
};

export type ListTemplatesDb = {
  template: {
    findMany: (args: {
      where: { active: true; storeTypes?: { has: string } };
      orderBy: [{ featured: "desc" }, { usageCount: "desc" }];
      select: {
        id: true;
        name: true;
        nameAr: true;
        slug: true;
        description: true;
        descriptionAr: true;
        price: true;
        billingType: true;
        thumbnail: true;
        previewUrl: true;
        features: true;
        usageCount: true;
        rating: true;
        reviews: true;
        isNew: true;
        featured: true;
        storeTypes: true;
        industries: true;
      };
    }) => Promise<TemplateRow[]>;
  };
};

// GET /api/templates — public: lists templates available for the storefront
// editor/onboarding picker. An optional ?storeType= narrows the list to
// templates built for that store type (see Template.storeTypes) — omitted
// entirely returns every active template, unfiltered. An optional
// ?industry= is a SOFT priority, not a filter: templates built for that
// industry (Template.industries) are sorted first (still respecting the
// existing featured/usageCount order within each group), everything else
// still follows — so no industry can ever produce an empty picker.
export async function handleListTemplates(db: ListTemplatesDb, storeType?: string | null, industry?: string | null): Promise<Response> {
  try {
    const templates = await db.template.findMany({
      where: { active: true, ...(storeType ? { storeTypes: { has: storeType } } : {}) },
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
        storeTypes: true,
        industries: true,
      },
    });

    const ordered = industry
      ? [...templates].sort((a, b) => Number(b.industries.includes(industry)) - Number(a.industries.includes(industry)))
      : templates;

    return NextResponse.json({ templates: ordered });
  } catch (error) {
    console.error("Error fetching templates:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
