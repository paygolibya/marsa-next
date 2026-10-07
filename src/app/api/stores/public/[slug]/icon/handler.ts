import { NextResponse } from "next/server";
import { renderIcon, type IconPurpose } from "@/lib/icon-resize";

type StoreRow = {
  customization: { logo: string | null; favicon: string | null; primaryColor: string | null } | null;
};

export type StoreIconDb = {
  store: {
    findUnique: (args: {
      where: { slug: string };
      select: { customization: { select: { logo: true; favicon: true; primaryColor: true } } };
    }) => Promise<StoreRow | null>;
  };
};

// 180 is iOS's own preferred apple-touch-icon size; 192/512 cover the Web
// App Manifest's any/maskable entries.
const ALLOWED_SIZES = new Set([180, 192, 512]);

// GET /api/stores/public/:slug/icon?size=192|512&purpose=any|maskable —
// the actual bytes behind every icon entry in the store's manifest (see
// ../manifest/handler.ts). Public, no auth: real icon pixels, same trust
// level as the manifest itself. Always serves a real PNG at the exact
// requested size, regardless of what the merchant actually uploaded (any
// format, any dimensions) or whether they've uploaded anything at all.
export async function handleGetStoreIcon(db: StoreIconDb, slug: string, searchParams: URLSearchParams, render = renderIcon): Promise<Response> {
  const size = Number(searchParams.get("size"));
  if (!ALLOWED_SIZES.has(size)) {
    return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  }
  const purpose: IconPurpose = searchParams.get("purpose") === "maskable" ? "maskable" : "any";

  const store = await db.store.findUnique({
    where: { slug },
    select: { customization: { select: { logo: true, favicon: true, primaryColor: true } } },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const sourceUrl = store.customization?.favicon || store.customization?.logo || null;
  const backgroundColor = store.customization?.primaryColor || "#0E2A3F";

  try {
    const png = await render(sourceUrl, size, purpose, backgroundColor);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        // Manifest icons are fetched once at install time, not on every
        // page load — safe to cache aggressively; a merchant changing
        // their logo is a rare, deliberate action, not something that
        // needs to propagate instantly.
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to render icon" }, { status: 500 });
  }
}
