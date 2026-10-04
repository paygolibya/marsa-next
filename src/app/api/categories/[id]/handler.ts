import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateCategorySchema } from "@/lib/validation";

type CategoryRow = { id: string; storeId: string };

export type CategoryByIdDb = {
  category: {
    findUnique: (args: { where: { id: string } }) => Promise<CategoryRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<CategoryRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsCategory(db: CategoryByIdDb, id: string, merchantId: string) {
  const category = await db.category.findUnique({ where: { id } });
  if (!category) return null;
  const store = await db.store.findFirst({ where: { id: category.storeId, merchantId } });
  return store ? category : null;
}

// PATCH /api/categories/:id — rename or reorder. slug never changes after
// creation (it's a public URL query value — changing it would break any
// bookmarked/shared filtered link), so this is intentionally name/position
// only, not a full re-derivation.
export async function handleUpdateCategory(db: CategoryByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsCategory(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const category = await db.category.update({ where: { id }, data: parsed.data });
    return NextResponse.json(category);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/categories/:id — products in this category fall back to
// uncategorized (Product.categoryId onDelete: SetNull), never deleted.
export async function handleDeleteCategory(db: CategoryByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsCategory(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
