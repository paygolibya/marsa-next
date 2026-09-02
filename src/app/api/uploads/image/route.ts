import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { getAuthMerchantId } from "@/lib/auth";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — generous enough for a logo/favicon, not a photo dump
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

// POST /api/uploads/image — Bearer auth, multipart {file}. Generic image
// upload to Vercel Blob, same mechanism as /api/payments/upload-receipt.
// Used by the theme customizer for a store's logo/favicon — previously
// those inputs existed in the UI but only ever console.logged the
// selected file, never actually uploading or saving anything.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 });

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "حجم الملف كبير جدًا (الحد الأقصى 2MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "نوع الملف غير مدعوم" }, { status: 400 });
    }

    const extension = file.name.split(".").pop() || "png";
    const uniqueName = `theme-images/${merchantId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
    const blob = await put(uniqueName, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}
