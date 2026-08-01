import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function DELETE(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId } = await req.json();

    const merchantStores = await prisma.store.findMany({
      where: { merchantId: targetMerchantId },
      select: { id: true },
    });

    const storeIds = merchantStores.map((store) => store.id);

    await prisma.orderItem.deleteMany({
      where: {
        order: {
          storeId: { in: storeIds },
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        storeId: { in: storeIds },
      },
    });

    await prisma.product.deleteMany({
      where: {
        storeId: { in: storeIds },
      },
    });

    await prisma.store.deleteMany({
      where: { merchantId: targetMerchantId },
    });

    await prisma.payment.deleteMany({
      where: { merchantId: targetMerchantId },
    });

    await prisma.merchant.delete({
      where: { id: targetMerchantId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting merchant:", error);
    return NextResponse.json({ error: "Failed to delete merchant" }, { status: 500 });
  }
}
