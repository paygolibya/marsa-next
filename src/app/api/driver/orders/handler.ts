import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { promisedDeliveryBy, tripoliDateKey, type DeliveryServiceLevel } from "@/lib/delivery/own-team";

type DriverOrderRow = {
  id: string;
  createdAt: Date;
  buyerName: string;
  buyerPhone: string;
  buyerCity: string;
  buyerAddress: string;
  totalCents: number;
  shippingCents: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  deliveryServiceLevel: string | null;
  deliveryStatus: string | null;
  cashCollectedCents: number | null;
  cashCollectedAt: Date | null;
  store: { name: string; merchant: { phone: string } };
  items: { productName: string; quantity: number; variantLabel: string | null }[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- args
// deliberately loose (not Prisma's exact generated shapes) so the real
// PrismaClient structurally satisfies this interface — same pattern as
// orders/handler.ts.
type Any = any;

export type DriverOrdersDeps = {
  db: {
    order: {
      findMany: (args: Any) => Promise<Any[]>;
    };
  };
  // Server-side authorization boundary — admins only for now (see the
  // driver page). Injectable so tests don't need a real merchant table.
  isDriver: (merchantId: string | null) => Promise<boolean>;
  now?: () => Date;
};

// Cash the driver should collect at the door: the full total for an unpaid
// COD order, nothing for an already-paid wallet order.
export function amountToCollectCents(order: { paymentMethod: string; paymentStatus: string; totalCents: number }): number {
  return order.paymentMethod === "cod" && order.paymentStatus !== "paid" ? order.totalCents : 0;
}

// GET /api/driver/orders — the own-team (Tripoli) orders due today in
// Africa/Tripoli time: same-day orders placed today, and next-morning
// orders placed yesterday. Unpaid wallet orders are left out (nothing to
// deliver until payment clears), as are cancelled/refunded ones.
export async function handleListDriverOrders(deps: DriverOrdersDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await deps.isDriver(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = deps.now ? deps.now() : new Date();
    const today = tripoliDateKey(now);
    const rows: DriverOrderRow[] = await deps.db.order.findMany({
      where: {
        deliveryServiceLevel: { not: null },
        // Anything due today was placed today or yesterday — 48h covers
        // both regardless of time of day.
        createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
        status: { notIn: ["cancelled", "refunded"] },
        OR: [{ paymentMethod: "cod" }, { paymentStatus: "paid" }],
      },
      select: {
        id: true,
        createdAt: true,
        buyerName: true,
        buyerPhone: true,
        buyerCity: true,
        buyerAddress: true,
        totalCents: true,
        shippingCents: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        deliveryServiceLevel: true,
        deliveryStatus: true,
        cashCollectedCents: true,
        cashCollectedAt: true,
        store: { select: { name: true, merchant: { select: { phone: true } } } },
        items: { select: { productName: true, quantity: true, variantLabel: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const orders = rows
      .map((o) => {
        const promisedBy = promisedDeliveryBy(o.createdAt, o.deliveryServiceLevel as DeliveryServiceLevel);
        return { ...o, promisedBy, amountToCollectCents: amountToCollectCents(o) };
      })
      .filter((o) => tripoliDateKey(o.promisedBy) === today);

    return NextResponse.json({ date: today, orders });
  } catch (error) {
    console.error("Error listing driver orders:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
