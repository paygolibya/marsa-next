import Image from "next/image";

// A logo the merchant can size up to "xl" (96px) without the header bar
// around it growing to match. The wrapper contributes zero HEIGHT to the
// flex row it sits in (so the row's own height is set by its other
// children — the cart button, the store name), while the actual image is
// absolutely positioned and vertically centered on the row's center line,
// free to overflow above/below the bar. Horizontally it still occupies its
// real width, so sibling spacing (gap to the store name) stays normal.
export function StorefrontLogo({
  src,
  alt,
  sizePx,
  rounded = "full",
  borderStyle,
}: {
  src: string;
  alt: string;
  sizePx: number;
  rounded?: "full" | "lg";
  borderStyle?: React.CSSProperties;
}) {
  return (
    <div className="relative shrink-0" style={{ width: sizePx, height: 0 }}>
      <Image
        src={src}
        alt={alt}
        width={sizePx}
        height={sizePx}
        unoptimized
        className={`absolute inset-x-0 top-1/2 -translate-y-1/2 object-cover ${rounded === "full" ? "rounded-full" : "rounded-lg"}`}
        style={{ width: sizePx, height: sizePx, ...borderStyle }}
      />
    </div>
  );
}
