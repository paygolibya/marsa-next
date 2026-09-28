import { NextResponse } from "next/server";

type StoreRow = {
  name: string;
  customization: { logo: string | null; favicon: string | null; primaryColor: string | null; secondaryColor: string | null } | null;
};

export type ManifestDb = {
  store: {
    findUnique: (args: {
      where: { slug: string };
      select: { name: true; customization: { select: { logo: true; favicon: true; primaryColor: true; secondaryColor: true } } };
    }) => Promise<StoreRow | null>;
  };
};

// GET /api/stores/public/:slug/manifest — a real per-store Web App
// Manifest, so "Add to Home Screen" installs each merchant's storefront as
// its own app (own name, own icon) instead of the platform's generic one.
export async function handleGetManifest(db: ManifestDb, slug: string): Promise<Response> {
  const store = await db.store.findUnique({
    where: { slug },
    select: {
      name: true,
      customization: { select: { logo: true, favicon: true, primaryColor: true, secondaryColor: true } },
    },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  // Prefer the merchant's dedicated favicon (meant to be a small square
  // icon) over the logo (often a wide banner), falling back to whichever
  // one is actually set.
  const icon = store.customization?.favicon || store.customization?.logo || null;

  const manifest = {
    name: store.name,
    short_name: store.name.slice(0, 20),
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: store.customization?.secondaryColor || "#ffffff",
    theme_color: store.customization?.primaryColor || "#0E2A3F",
    icons: icon
      ? [
          { src: icon, sizes: "192x192", type: "image/png" },
          { src: icon, sizes: "512x512", type: "image/png" },
        ]
      : [],
  };

  return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
