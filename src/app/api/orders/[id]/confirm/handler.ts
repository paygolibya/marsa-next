import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { sendOrderConfirmationEmail } from "@/lib/integrations/email";

// Same DI shape as the sibling refund route (see refund/handler.ts) — real
// prisma injected from route.ts, a fake injected from handler.test.ts.
export type ConfirmDb = {
  order: {
    findFirst: (args: {
      where: { id: string; store: { merchantId: string } };
      include: { store: { select: { slug: true } } };
    }) => Promise<{
      id: string;
      status: string;
      buyerName: string;
      buyerEmail: string | null;
      totalCents: number;
      store: { slug: string };
    } | null>;
    update: (args: { where: { id: string }; data: { status: string } }) => Promise<unknown>;
  };
};

// Lets a merchant manually move an order out of "pending" — needed because
// automatic confirmation only happens via courier dispatch (physical-goods
// stores) or a payment webhook (wallet orders); a digital-goods order placed
// before Store.type "digital" existed, or any order whose automatic path simply
// failed, would otherwise be stuck pending forever with no way forward.
export async function handleConfirmOrder(db: ConfirmDb, req: Request, orderId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const order = await db.order.findFirst({
    where: { id: orderId, store: { merchantId } },
    include: { store: { select: { slug: true } } },
  });
  if (!order) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "هذا الطلب ليس قيد الانتظار" }, { status: 400 });
  }

  await db.order.update({ where: { id: order.id }, data: { status: "confirmed" } });

  // Best-effort, same convention as refund's status email — a failed send
  // never undoes the confirmation itself.
  await sendOrderConfirmationEmail({
    id: order.id,
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    totalCents: order.totalCents,
    storeSlug: order.store.slug,
  });

  return NextResponse.json({ success: true });
}
