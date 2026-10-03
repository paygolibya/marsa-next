import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";

// Same ownership-check shape as orders/[id]/confirm — a merchant can only
// mark their own store's inquiries handled.
export type MarkInquiryHandledDb = {
  inquiry: {
    findFirst: (args: { where: { id: string; store: { merchantId: string } } }) => Promise<{ id: string } | null>;
    update: (args: { where: { id: string }; data: { handled: true } }) => Promise<unknown>;
  };
};

export async function handleMarkInquiryHandled(db: MarkInquiryHandledDb, req: Request, inquiryId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const inquiry = await db.inquiry.findFirst({ where: { id: inquiryId, store: { merchantId } } });
  if (!inquiry) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

  await db.inquiry.update({ where: { id: inquiry.id }, data: { handled: true } });

  return NextResponse.json({ success: true });
}
