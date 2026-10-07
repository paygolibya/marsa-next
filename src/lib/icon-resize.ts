import path from "node:path";
import sharp from "sharp";

export type IconPurpose = "any" | "maskable";

// The platform's own 512x512 icon — used whenever a store has no logo or
// favicon set at all, so "Add to Home Screen" is never blocked by a
// missing icon (the manifest previously shipped icons: [] in that case,
// which fails Chrome's installability criteria outright).
const FALLBACK_ICON_PATH = path.join(process.cwd(), "src/app/icon.png");

// Maskable icons need real padding (not just a plain resize) so an
// adaptive-icon mask (circle, squircle, ...) on Android doesn't clip the
// actual logo — the spec's own guidance is roughly an 80% "safe zone",
// centered on an opaque background so transparent corners don't show
// through as a hard-edged shape against the home screen wallpaper.
const MASKABLE_SAFE_ZONE_RATIO = 0.8;

async function fetchSourceBuffer(url: string | null): Promise<Buffer> {
  if (!url) return sharp(FALLBACK_ICON_PATH).toBuffer();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`icon source fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // A broken/unreachable upload URL shouldn't ever take installability
    // down with it — fall back the same way a missing one does.
    return sharp(FALLBACK_ICON_PATH).toBuffer();
  }
}

// Renders a single PNG icon at the given size — resized/converted
// regardless of the source's original dimensions or format (jpeg/webp/
// svg/ico/whatever a merchant actually uploaded), so the manifest's own
// `type: "image/png"` claim is always true, and purpose="maskable" gets
// real safe-zone padding instead of a plain resize.
export async function renderIcon(sourceUrl: string | null, size: number, purpose: IconPurpose, backgroundColor: string): Promise<Buffer> {
  const source = await fetchSourceBuffer(sourceUrl);

  if (purpose === "any") {
    return sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
  }

  const innerSize = Math.round(size * MASKABLE_SAFE_ZONE_RATIO);
  const inner = await sharp(source)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: backgroundColor,
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toBuffer();
}
