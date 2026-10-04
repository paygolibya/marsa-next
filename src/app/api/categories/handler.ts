import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { customAlphabet } from "nanoid";
import { getAuthMerchantId } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createCategorySchema } from "@/lib/validation";

// Digits only — same reasoning as the store-slug collision suffix (see
// src/app/api/stores/handler.ts): an Arabic category slug mixed with a
// Latin-letter suffix isn't the hostname-encoding issue stores have (this
// slug is only ever used as a query-string value, never a Host header),
// but digits keep the slug visually clean either way.
const numericSuffix = customAlphabet("0123456789", 4);

type CategoryRow = { id: string; storeId: string; name: string; slug: string; position: number };

export type CategoriesDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  category: {
    findUnique: (args: { where: { storeId_slug: { storeId: string; slug: string } } }) => Promise<CategoryRow | null>;
    create: (args: { data: { storeId: string; name: string; slug: string } }) => Promise<CategoryRow>;
    findMany: (args: { where: { storeId: string }; orderBy: { position: "asc" } }) => Promise<CategoryRow[]>;
  };
};

// POST /api/categories — create a category for one of the merchant's stores.
export async function handleCreateCategory(db: CategoriesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, name } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    let slug = slugify(name) || numericSuffix();
    const clash = await db.category.findUnique({ where: { storeId_slug: { storeId, slug } } });
    if (clash) slug = `${slug}-${numericSuffix()}`;

    const category = await db.category.create({ data: { storeId, name, slug } });
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/categories?storeId=... — list categories for a store the merchant owns.
export async function handleListCategories(db: CategoriesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const categories = await db.category.findMany({ where: { storeId }, orderBy: { position: "asc" } });
  return NextResponse.json(categories);
}
