import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) {
    return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tier = (formData.get("tier") as string | null) || "professional";
    const selectedMethod = (formData.get("selectedMethod") as string | null) || null;
    const amount = Number(formData.get("amount") || 0);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileExtension = file.name.split(".").pop() || "bin";
    const uniqueName = `${merchantId}-${Date.now()}-${randomBytes(4).toString("hex")}.${fileExtension}`;

    const uploadsDir = join(process.cwd(), "public/receipts");
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, uniqueName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const payment = await prisma.payment.create({
      data: {
        merchantId,
        tier,
        amount,
        status: "pending",
        currency: "LYD",
        receiptFile: `/receipts/${uniqueName}`,
        receiptUploadedAt: new Date(),
      },
    });

    await prisma.merchant.update({
      where: { id: merchantId },
      data: {
        subscriptionTier: tier === "professional" || tier === "advanced" ? tier : "basic",
        selectedPaymentMethod: selectedMethod || null,
      },
    });

    return NextResponse.json({ success: true, paymentId: payment.id, message: "Receipt uploaded successfully" });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Failed to upload receipt" }, { status: 500 });
  }
}
