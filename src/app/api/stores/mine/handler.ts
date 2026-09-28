import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

export type StoresMineDb = {
  store: {
    findMany: (args: { where: { merchantId: string }; include: { customization: { include: { template: true } } } }) => Promise<unknown[]>;
  };
};

// GET /api/stores/mine — a merchant's own stores (needs auth).
export async function handleStoresMine(db: StoresMineDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const stores = await db.store.findMany({
      where: { merchantId },
      include: { customization: { include: { template: true } } },
    });
    return NextResponse.json(stores);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
