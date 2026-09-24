import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAuthMerchantId } from "@/lib/auth";

// 15MB — a real photo straight off a phone camera easily runs 3-10MB; the
// old 2MB cap (plus Vercel's separate, unchangeable ~4.5MB request-body
// limit for Serverless Functions, which this route used to proxy every
// upload through) silently broke most real product-photo uploads. Client
// uploads — the browser talks to Blob storage directly, this route only
// ever issues a short-lived signed token — sidestep that platform limit
// entirely, so this number is now a real product-photo limit, not a
// workaround for it.
const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];

// POST /api/uploads/image — Bearer auth. Token-issuing endpoint for Vercel
// Blob's client-upload flow (see @vercel/blob/client's `upload()`, used by
// src/lib/api.ts's `uploadImage`) — the file itself never passes through
// this server, only a signed token authorizing the browser to upload
// directly to Blob storage. Used by the theme customizer for a store's
// logo/favicon and by the product gallery uploader.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ merchantId }),
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Image upload token error:", error);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 400 });
  }
}
