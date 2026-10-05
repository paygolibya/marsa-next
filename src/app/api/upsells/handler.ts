import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createUpsellSchema } from "@/lib/validation";

type UpsellRow = {
  id: string;
  storeId: string;
  triggerProductId: string;
  offeredProductId: string;
  active: boolean;
  triggerProduct: { name: string };
  offeredProduct: { name: string };
};

export type UpsellsDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  product: { findMany: (args: { where: { id: { in: string[] }; storeId: string } }) => Promise<{ id: string }[]> };
  upsell: {
    create: (args: {
      data: { storeId: string; triggerProductId: string; offeredProductId: string };
      include: { triggerProduct: { select: { name: true } }; offeredProduct: { select: { name: true } } };
    }) => Promise<UpsellRow>;
    findMany: (args: {
      where: { storeId: string };
      include: { triggerProduct: { select: { name: true } }; offeredProduct: { select: { name: true } } };
      orderBy: { createdAt: "desc" };
    }) => Promise<UpsellRow[]>;
  };
};

// POST /api/upsells — configure "buyers of X often also want Y".
export async function handleCreateUpsell(db: UpsellsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createUpsellSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, triggerProductId, offeredProductId } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const owned = await db.product.findMany({ where: { id: { in: [triggerProductId, offeredProductId] }, storeId } });
    if (owned.length !== 2) {
      return NextResponse.json({ error: "أحد المنتجات المختارة غير موجود في هذا المتجر" }, { status: 400 });
    }

    try {
      const upsell = await db.upsell.create({
        data: { storeId, triggerProductId, offeredProductId },
        include: { triggerProduct: { select: { name: true } }, offeredProduct: { select: { name: true } } },
      });
      return NextResponse.json(upsell, { status: 201 });
    } catch (err) {
      // Unique constraint on (storeId, triggerProductId, offeredProductId) —
      // this exact pair is already configured.
      if (typeof err === "object" && err !== null && "code" in err && err.code === "P2002") {
        return NextResponse.json({ error: "هذا الاقتراح موجود بالفعل" }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/upsells?storeId=... — list a store's configured upsells.
export async function handleListUpsells(db: UpsellsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const upsells = await db.upsell.findMany({
    where: { storeId },
    include: { triggerProduct: { select: { name: true } }, offeredProduct: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(upsells);
}
