import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

type ReviewRow = { rating: number; reviewText: string | null; reviewTextAr: string | null; createdAt: Date };
type TemplateRow = { id: string; slug: string; reviewsData: ReviewRow[] };

export type TemplateBySlugDb = {
  template: {
    findUnique: (args: {
      where: { slug: string };
      include: {
        reviewsData: {
          select: { rating: true; reviewText: true; reviewTextAr: true; createdAt: true };
          take: 5;
          orderBy: { createdAt: "desc" };
        };
      };
    }) => Promise<TemplateRow | null>;
  };
};

export async function handleGetTemplate(db: TemplateBySlugDb, slug: string): Promise<Response> {
  try {
    const template = await db.template.findUnique({
      where: { slug },
      include: {
        reviewsData: {
          select: {
            rating: true,
            reviewText: true,
            reviewTextAr: true,
            createdAt: true,
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching template:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch template" }, { status: 500 });
  }
}
