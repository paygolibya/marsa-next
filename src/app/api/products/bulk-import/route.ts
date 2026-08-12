import { NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

type CsvRow = { name?: string; price?: string; imageUrl?: string; stock?: string };

// POST /api/products/bulk-import — CSV columns: name, price, imageUrl, stock.
// price is LYD (converted to cents), matching the manual add-product form.
// Valid rows are created; invalid rows are reported with their row number,
// never silently dropped or failing the whole batch.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const formData = await req.formData();
    const storeId = formData.get("storeId") as string | null;
    const file = formData.get("file") as File | null;
    if (!storeId || !file) {
      return NextResponse.json({ error: "storeId and file are required" }, { status: 400 });
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const text = await file.text();
    const parsed = Papa.parse<CsvRow>(text, { header: true, skipEmptyLines: true });

    const toCreate: { name: string; priceCents: number; imageUrl: string | null; trackInventory: boolean; stockQty: number }[] = [];
    const errors: { row: number; message: string }[] = [];

    parsed.data.forEach((row, index) => {
      const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
      const name = row.name?.trim();
      if (!name) {
        errors.push({ row: rowNumber, message: "اسم المنتج مطلوب" });
        return;
      }
      const price = parseFloat(row.price ?? "");
      if (!Number.isFinite(price) || price <= 0) {
        errors.push({ row: rowNumber, message: "السعر غير صالح" });
        return;
      }
      const stockRaw = row.stock?.trim();
      const stockQty = stockRaw ? parseInt(stockRaw, 10) : 0;
      if (stockRaw && !Number.isFinite(stockQty)) {
        errors.push({ row: rowNumber, message: "الكمية غير صالحة" });
        return;
      }

      toCreate.push({
        name,
        priceCents: Math.round(price * 100),
        imageUrl: row.imageUrl?.trim() || null,
        trackInventory: Boolean(stockRaw),
        stockQty: stockRaw ? stockQty : 0,
      });
    });

    if (toCreate.length > 0) {
      await prisma.product.createMany({
        data: toCreate.map((p) => ({ ...p, storeId })),
      });
    }

    return NextResponse.json({ createdCount: toCreate.length, errors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
