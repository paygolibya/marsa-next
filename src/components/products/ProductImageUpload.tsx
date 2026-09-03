"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

// Replaces a plain "paste an image URL" text field — merchants had to
// host the image somewhere else themselves first, which for most people
// meant no product photos at all. Real upload now, same mechanism as the
// theme customizer's logo/favicon (Vercel Blob via /api/uploads/image).
export default function ProductImageUpload({
  imageUrl,
  onChange,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(token, file);
      onChange(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر رفع الصورة");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <span className="block text-sm font-bold text-harbor mb-1.5">صورة المنتج</span>
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover border border-harbor/10 shrink-0" />
        ) : (
          <div className="h-16 w-16 rounded-lg border border-dashed border-harbor/20 flex items-center justify-center text-[10px] text-rope shrink-0">
            لا صورة
          </div>
        )}
        <label className="flex-1">
          <span className="inline-block rounded-full border border-harbor/20 px-4 py-2 text-sm font-bold text-harbor hover:bg-harbor/5 cursor-pointer transition-colors">
            {uploading ? "جارٍ الرفع..." : imageUrl ? "تغيير الصورة" : "رفع صورة"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
        {imageUrl && (
          <button type="button" onClick={() => onChange(null)} className="text-signal text-xs font-bold shrink-0">
            إزالة
          </button>
        )}
      </div>
      {error && <p className="text-signal text-xs mt-1">{error}</p>}
    </div>
  );
}
