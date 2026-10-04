import Image from "next/image";
import { StorefrontLogo } from "./StorefrontLogo";

// The one place the "header-style / logo-size / cart-position" layout logic
// lives, shared by Modern and Bold (the only two templates with these
// controls). Before this existed, the same centered-vs-standard branching,
// the StorefrontLogo-vs-plain-Image fallback, the absolute cart-button
// positioning, and the min-h-14 collapse guard were hand-duplicated in both
// templates — three bugs in a row (header style not applying, cart position
// coupled to the logo, cart overflowing a collapsed bar) were all fixed in
// that duplicated code, in both places, at different times. Each template
// still owns its own outer background/border styling and its own name/
// tagline block and cart button (those genuinely differ) — only the shared
// layout mechanics live here.
export function StorefrontHeaderRow({
  headerCentered,
  showLogo,
  logo,
  storeName,
  logoPx,
  identityExtra,
  cartOnRight,
  cartButton,
  paddingClassName = "py-3",
  logoGapClassName = "gap-2",
}: {
  headerCentered: boolean;
  showLogo: boolean;
  logo: string | null | undefined;
  storeName: string;
  logoPx: number;
  // Whatever goes next to the logo — name, tagline, whatever that
  // template's own header shows. Each template's own markup, since it
  // genuinely differs (Modern wraps name+tagline in a block; Bold is just
  // a name span).
  identityExtra?: React.ReactNode;
  cartOnRight: boolean;
  cartButton: React.ReactNode;
  paddingClassName?: string;
  logoGapClassName?: string;
}) {
  // The cart button is positioned absolute (so cartOnRight can place it on
  // either side independent of the logo/name group), which means it's out
  // of normal flex flow and can't squeeze the identity block the way a
  // real sibling would. Without reserving its footprint here, a long
  // store name has nothing stopping it from growing straight under the
  // button — confirmed live (and re-confirmed with real bounding-box
  // measurements against the actual broken page before writing this fix):
  // in this RTL layout the logo/name group is right-anchored and grows
  // LEFTWARD, so when the cart sits at left-6 (cartOnRight=false) the
  // reservation has to eat into the row's LEFT padding, not its right —
  // getting this backwards silently leaves the bug in place since the
  // padding would land on the side nothing was ever overlapping. ~8rem
  // comfortably covers either template's cart button (pill + badge) at
  // this row's font sizes. Measured against the real deployed button
  // (left-6 offset + ~118px width = ~142px total reach) — pl/pr-32 (128px)
  // was tried first and came up 14px short, still overlapping; 40 (160px)
  // leaves real margin instead of being exactly on the edge of correct.
  const cartReserveClassName = headerCentered ? "" : cartOnRight ? "pr-40" : "pl-40";

  return (
    <div
      className={`relative min-h-14 mx-auto max-w-6xl px-6 ${paddingClassName} flex items-center gap-4 ${cartReserveClassName} ${
        headerCentered ? "flex-col justify-center text-center" : ""
      }`}
    >
      <div className={`flex items-center ${logoGapClassName} min-w-0 ${headerCentered ? "flex-col" : ""}`}>
        {showLogo &&
          logo &&
          (headerCentered ? (
            // The overflow-past-the-bar trick (StorefrontLogo) only works
            // when the logo is a row sibling — in centered mode it's
            // stacked in a flex-COLUMN, where height genuinely matters for
            // layout, so a plain sized image is used here instead (a
            // bigger logo grows the header in this mode).
            <Image
              src={logo}
              alt={storeName}
              width={logoPx}
              height={logoPx}
              unoptimized
              className="rounded-full object-cover"
              style={{ width: logoPx, height: logoPx }}
            />
          ) : (
            <StorefrontLogo src={logo} alt={storeName} sizePx={logoPx} />
          ))}
        {identityExtra}
      </div>

      {/* Positioned independently of the logo/name group above — cart
          placement is its own merchant choice, not tied to headerStyle.
          min-h-14 on the row above keeps this from overflowing a collapsed
          bar when the logo uses the zero-height trick and the name is
          hidden. */}
      <div className={`absolute top-1/2 -translate-y-1/2 ${cartOnRight ? "right-6" : "left-6"}`}>{cartButton}</div>
    </div>
  );
}
