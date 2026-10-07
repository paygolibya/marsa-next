import type { MetadataRoute } from "next";

// The platform's own Web App Manifest (the dashboard/marketing site, not a
// merchant storefront — those get their own per-store manifest, see
// api/stores/public/[slug]/manifest). Next's file-convention auto-serves
// this at /manifest.webmanifest and links it from <head> automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "رفقة",
    short_name: "رفقة",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0E2A3F",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
