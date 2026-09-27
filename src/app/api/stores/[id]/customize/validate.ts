// Pure enum-validation for the customize route's size/position fields —
// extracted so the "reject anything not on the allow-list, else undefined
// (meaning: leave unchanged / use the Prisma default)" logic can be unit
// tested without a request or Prisma.

const LOGO_SIZES = ["sm", "md", "lg", "xl"];
const SIZES = ["sm", "md", "lg"];
const CART_POSITIONS = ["left", "right"];

function validEnum(value: unknown, allowed: string[]): string | undefined {
  return typeof value === "string" && allowed.includes(value) ? value : undefined;
}

export function validateCustomizationEnums(body: {
  logoSize?: unknown;
  textSize?: unknown;
  coverImageSize?: unknown;
  heroSize?: unknown;
  cartPosition?: unknown;
}): {
  validLogoSize: string | undefined;
  validTextSize: string | undefined;
  validCoverImageSize: string | undefined;
  validHeroSize: string | undefined;
  validCartPosition: string | undefined;
} {
  return {
    validLogoSize: validEnum(body.logoSize, LOGO_SIZES),
    validTextSize: validEnum(body.textSize, SIZES),
    validCoverImageSize: validEnum(body.coverImageSize, SIZES),
    validHeroSize: validEnum(body.heroSize, SIZES),
    validCartPosition: validEnum(body.cartPosition, CART_POSITIONS),
  };
}
