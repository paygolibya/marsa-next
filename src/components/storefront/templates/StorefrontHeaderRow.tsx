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
  return (
    <div
      className={`relative min-h-14 mx-auto max-w-6xl px-6 ${paddingClassName} flex items-center gap-4 ${
        headerCentered ? "flex-col justify-center text-center" : ""
      }`}
    >
      <div className={`flex items-center ${logoGapClassName} ${headerCentered ? "flex-col" : ""}`}>
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
