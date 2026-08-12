import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createReviewSchema } from "@/lib/validation";
import { verifyBuyerOrder } from "@/lib/verify-buyer";

// GET /api/products/:id/reviews — public list. Never returns buyerPhone.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviews = await prisma.productReview.findMany({
    where: { productId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, productId: true, buyerName: true, rating: true, reviewText: true, createdAt: true },
  });
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  return NextResponse.json({ reviews, average, count: reviews.length });
}

// POST /api/products/:id/reviews — public, gated by order-id + phone match
// (verify-buyer) plus proof the order actually contained this product.
// The @@unique([orderId, productId]) constraint caps it at one review per
// purchase.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const body = await req.json();
    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { orderId, phone, buyerName, rating, reviewText } = parsed.data;

    const order = await verifyBuyerOrder(orderId, phone);
    if (!order) {
      return NextResponse.json({ error: "لم يتم العثور على طلب مطابق" }, { status: 404 });
    }
    if (!order.items.some((i) => i.productId === productId)) {
      return NextResponse.json({ error: "هذا الطلب لا يحتوي على هذا المنتج" }, { status: 400 });
    }

    const review = await prisma.productReview.create({
      data: { productId, orderId, buyerName, buyerPhone: phone, rating, reviewText: reviewText || null },
    });

    return NextResponse.json(
      { id: review.id, productId: review.productId, buyerName: review.buyerName, rating: review.rating, reviewText: review.reviewText, createdAt: review.createdAt },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "لقد قمت بتقييم هذا المنتج مسبقًا" }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
