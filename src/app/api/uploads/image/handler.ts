import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { HandleUploadBody } from "@vercel/blob/client";
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

export type UploadImageDeps = {
  handleUpload: (args: {
    body: HandleUploadBody;
    request: Request;
    onBeforeGenerateToken: () => Promise<{
      allowedContentTypes: string[];
      maximumSizeInBytes: number;
      addRandomSuffix: boolean;
      tokenPayload: string;
    }>;
  }) => Promise<unknown>;
};

// POST /api/uploads/image — Bearer auth. Token-issuing endpoint for Vercel
// Blob's client-upload flow — the file itself never passes through this
// server, only a signed token authorizing the browser to upload directly
// to Blob storage. handleUpload itself (the real @vercel/blob/client SDK
// call) is injected rather than tested against — what's actually this
// route's own logic, and worth testing without a real Blob account, is
// the auth gate and the token's own constraints (allowed types, size cap,
// merchant scoping via tokenPayload).
export async function handleImageUpload(deps: UploadImageDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await deps.handleUpload({
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
    Sentry.captureException(error);
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 400 });
  }
}
