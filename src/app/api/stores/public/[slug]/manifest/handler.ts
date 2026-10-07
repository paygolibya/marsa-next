import { NextResponse } from "next/server";

type StoreRow = {
  name: string;
  customization: { primaryColor: string | null; secondaryColor: string | null } | null;
};

export type ManifestDb = {
  store: {
    findUnique: (args: {
      where: { slug: string };
      select: { name: true; customization: { select: { primaryColor: true; secondaryColor: true } } };
    }) => Promise<StoreRow | null>;
  };
};

// A short_name much past ~12 characters gets truncated by the OS under
// the home screen icon anyway (platform behavior, not something a longer
// string fixes) — cut at a word boundary with an ellipsis instead of a
// blind character slice that could land mid-word.
function toShortName(name: string, maxLength = 20): string {
  if (name.length <= maxLength) return name;
  const truncated = name.slice(0, maxLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trimEnd()}…`;
}

// GET /api/stores/public/:slug/manifest — a real per-store Web App
// Manifest, so "Add to Home Screen" installs each merchant's storefront as
// its own app (own name, own icon) instead of the platform's generic one.
export async function handleGetManifest(db: ManifestDb, slug: string): Promise<Response> {
  const store = await db.store.findUnique({
    where: { slug },
    select: {
      name: true,
      customization: { select: { primaryColor: true, secondaryColor: true } },
    },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  // Every icon is served through its own resizing endpoint (not the raw
  // merchant-uploaded file) — it always returns a real, correctly-sized
  // PNG, and falls back to the platform's own icon when the store has no
  // logo/favicon set, so a manifest never ships icons: [] (which fails
  // Chrome's installability criteria outright).
  const iconUrl = (size: 192 | 512, purpose?: "maskable") =>
    `/api/stores/public/${slug}/icon?size=${size}${purpose ? `&purpose=${purpose}` : ""}`;

  const manifest = {
    name: store.name,
    short_name: toShortName(store.name),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: store.customization?.secondaryColor || "#ffffff",
    theme_color: store.customization?.primaryColor || "#0E2A3F",
    icons: [
      { src: iconUrl(192), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl(512), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: iconUrl(512, "maskable"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
