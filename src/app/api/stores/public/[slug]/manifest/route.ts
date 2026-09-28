import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stores/public/:slug/manifest — a real per-store Web App
// Manifest, so "Add to Home Screen" installs each merchant's storefront as
// its own app (own name, own icon) instead of the platform's generic
// "رفقة — من مرسى" / default icon. Referenced from
// src/app/store/[slug]/layout.tsx's generateMetadata via metadata.manifest.
//
// start_url/scope are deliberately relative ("/") rather than an absolute
// URL — the manifest is always fetched from whatever origin the merchant's
// storefront is actually being viewed on (the {slug}.rifqa.ly subdomain, a
// verified custom domain, or rifqa.ly/store/{slug} directly), and relative
// URLs in a manifest resolve against that same origin per the Web Manifest
// spec, so this is correct across all three without knowing the host here.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
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
    // Real dimensions of a merchant-uploaded image are unknown here without
    // fetching and decoding the file — labeling the same source at both
    // common sizes is a standard, widely-used workaround for user-uploaded
    // icons of unknown resolution; browsers scale as needed.
    icons: icon
      ? [
          { src: icon, sizes: "192x192", type: "image/png" },
          { src: icon, sizes: "512x512", type: "image/png" },
        ]
      : [],
  };

  return NextResponse.json(manifest, { headers: { "Content-Type": "application/manifest+json" } });
}
