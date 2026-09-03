"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

const MAX_IMAGES = 8;

// A real product photo gallery — multiple images, drag to reorder (the
// first image is always what shows in the storefront grid/cart, matching
// how imageUrl is derived server-side as images[0]). Replaces the earlier
// single-photo ProductImageUpload.
export default function ProductGalleryUpload({ images, onChange }: { images: string[]; onChange: (images: string[]) => void }) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function handleFiles(files: FileList) {
    if (!token) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`الحد الأقصى ${MAX_IMAGES} صور`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of toUpload) {
        const { url } = await api.uploadImage(token, file);
        uploaded.push(url);
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر رفع إحدى الصور");
    } finally {
      setUploading(false);
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      <span className="block text-sm font-bold text-harbor mb-1.5">صور المنتج</span>
      <p className="text-xs text-rope mb-2">أول صورة هي التي تظهر في قائمة المتجر — اسحب لإعادة الترتيب.</p>

      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <div
            key={url + i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) moveTo(dragIndex, i);
              setDragIndex(null);
            }}
            className="relative h-20 w-20 rounded-lg border border-harbor/10 overflow-hidden cursor-move group shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute bottom-0 inset-x-0 bg-harbor/80 text-white text-[9px] text-center py-0.5">الرئيسية</span>}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 left-1 h-5 w-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <label className="h-20 w-20 rounded-lg border border-dashed border-harbor/20 flex items-center justify-center text-xs text-rope cursor-pointer hover:border-brass/50 transition-colors shrink-0">
            {uploading ? "..." : "+ إضافة"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files?.length) void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {error && <p className="text-signal text-xs mt-2">{error}</p>}
    </div>
  );
}
