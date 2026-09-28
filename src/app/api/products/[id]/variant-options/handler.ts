import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { getAuthMerchantId } from "@/lib/auth";
import { setProductVariantOptionsSchema } from "@/lib/validation";

type VariantRow = { id: string; productId: string; options: unknown };

export type VariantOptionsDb = {
  product: {
    findUnique: (args: { where: { id: string } }) => Promise<{ id: string; storeId: string } | null>;
    update: (args: {
      where: { id: string };
      data: { variantOptions: Prisma.InputJsonValue | typeof Prisma.JsonNull };
    }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  productVariant: {
    findMany: (args: { where: { productId: string }; orderBy?: { id: "asc" } }) => Promise<VariantRow[]>;
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
    createMany: (args: { data: { productId: string; options: Record<string, string> }[] }) => Promise<unknown>;
  };
  $transaction: (ops: unknown[]) => Promise<unknown>;
};

function cartesianCombinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, opt) => (acc.length === 0 ? opt.values.map((v) => ({ [opt.name]: v })) : acc.flatMap((combo) => opt.values.map((v) => ({ ...combo, [opt.name]: v })))),
    []
  );
}

// Two combinations are the same variant regardless of key order — Prisma/
// Postgres JSON equality can be order-sensitive, so compare in JS against
// a stable (sorted-key) stringification instead of trusting DB-level
// equality.
function comboKey(combo: Record<string, string>): string {
  return JSON.stringify(Object.keys(combo).sort().map((k) => [k, combo[k]]));
}

// POST /api/products/:id/variant-options — { options: [{name, values[]}] }.
// Regenerates the combination matrix from the option types: an existing
// variant whose combination still appears is left untouched (its price/
// stock survive), a combination that's new gets a fresh row (price null =
// inherit the product's own price, stock 0), and a variant whose
// combination no longer exists (a value was removed) is deleted. Empty
// options (`[]`) clears variants entirely — back to a plain product.
export async function handleSetVariantOptions(db: VariantOptionsDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    const store = await db.store.findFirst({ where: { id: product.storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const body = await req.json();
    const parsed = setProductVariantOptionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { options } = parsed.data;

    const combinations = cartesianCombinations(options);
    const wantedKeys = new Set(combinations.map(comboKey));

    const existing = await db.productVariant.findMany({ where: { productId: id } });
    const existingByKey = new Map(existing.map((v) => [comboKey(v.options as Record<string, string>), v]));

    const toDelete = existing.filter((v) => !wantedKeys.has(comboKey(v.options as Record<string, string>)));
    const toCreate = combinations.filter((c) => !existingByKey.has(comboKey(c)));

    await db.$transaction([
      db.product.update({ where: { id }, data: { variantOptions: options.length > 0 ? options : Prisma.JsonNull } }),
      ...(toDelete.length > 0 ? [db.productVariant.deleteMany({ where: { id: { in: toDelete.map((v) => v.id) } } })] : []),
      ...(toCreate.length > 0 ? [db.productVariant.createMany({ data: toCreate.map((options) => ({ productId: id, options })) })] : []),
    ]);

    // id (cuid) ordering is monotonic enough for a stable, predictable
    // list in the editor UI without needing a dedicated sort/createdAt column.
    const variants = await db.productVariant.findMany({ where: { productId: id }, orderBy: { id: "asc" } });
    return NextResponse.json({ variantOptions: options, variants });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
