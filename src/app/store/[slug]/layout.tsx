import type { Metadata, Viewport } from "next";
import { prisma } from "@/lib/prisma";

// The storefront page itself (./page.tsx) is a Client Component (it fetches
// its data via useEffect + api.publicStore) — Client Components can't
// export generateMetadata/generateViewport, which only run in Server
// Components.
// This layout exists specifically to carry real per-request, server-rendered
// metadata for each merchant's own storefront: its own <title>, its own
// manifest (own name + icon on "Add to Home Screen"), its own
// apple-touch-icon, and its own theme-color — none of which existed before;
// every storefront showed the platform's generic "رفقة — من مرسى" name and
// icon regardless of which merchant it was.
async function getStoreBranding(slug: string) {
  return prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      aboutText: true,
      customization: { select: { primaryColor: true, logo: true, coverImage: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  if (!store) return {};

  // Every icon is served through the resizing endpoint (see
  // api/stores/public/[slug]/icon) — a real, correctly-sized PNG
  // regardless of what the merchant actually uploaded, and always
  // present even when they haven't uploaded anything at all (it falls
  // back to the platform's own icon rather than omitting icons entirely).
  // apple-touch-icon specifically wants 180x180, not the manifest's
  // 192/512 sizes.
  const iconUrl = (size: 180 | 192 | 512) => `/api/stores/public/${slug}/icon?size=${size}`;

  // Link previews when a merchant shares their store (or runs an ad
  // pointing at it): cover image first, then logo, then the resized
  // store icon so there is always some image.
  const description = store.aboutText?.trim().slice(0, 160) || `تسوّق من ${store.name} أونلاين — اطلب الآن والتوصيل لكل ليبيا.`;
  const shareImage = store.customization?.coverImage || store.customization?.logo || iconUrl(512);

  return {
    title: store.name,
    description,
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      images: [{ url: shareImage, alt: store.name }],
    },
    twitter: {
      card: store.customization?.coverImage ? "summary_large_image" : "summary",
      title: store.name,
      description,
      images: [shareImage],
    },
    manifest: `/api/stores/public/${slug}/manifest`,
    appleWebApp: {
      capable: true,
      title: store.name,
      statusBarStyle: "default",
    },
    // Next's `appleWebApp.capable` only emits the newer, unprefixed
    // "mobile-web-app-capable" tag — iOS Safari specifically still checks
    // this legacy Apple-prefixed one to hide its browser chrome when
    // launched from the home screen, so both need to be present.
    other: {
      "apple-mobile-web-app-capable": "yes",
    },
    icons: {
      icon: [{ url: iconUrl(192) }],
      apple: [{ url: iconUrl(180) }],
      shortcut: [{ url: iconUrl(192) }],
    },
  };
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params;
  const store = await getStoreBranding(slug);
  return {
    themeColor: store?.customization?.primaryColor || "#0E2A3F",
  };
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
