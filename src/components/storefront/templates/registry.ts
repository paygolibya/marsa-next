import ModernTemplate from "./ModernTemplate";
import BoldTemplate from "./BoldTemplate";
import LuxuryTemplate from "./LuxuryTemplate";
import MarketplaceTemplate from "./MarketplaceTemplate";
import type { StorefrontTemplateProps } from "./types";

// The one place a template slug maps to its real component — shared by
// the actual storefront (store/[slug]/page.tsx) and the template-picker
// preview (/preview/[templateSlug]) so both ever render the SAME
// component for a given slug; each Template row's componentPath
// ("free/modern", "paid/luxury", ...) signals real per-template
// components were always the intent. Falls back to Modern for a store
// with no template set at all (pre-template-system stores).
//
// Deliberately its own file, not part of types.ts: every template
// component itself imports a real value (normalizeSectionOrder) from
// types.ts, so importing the components back into types.ts would create
// a genuine runtime circular import, not just a type-only one.
export const STOREFRONT_TEMPLATES: Record<string, (props: StorefrontTemplateProps) => React.ReactElement> = {
  modern: ModernTemplate,
  bold: BoldTemplate,
  luxury: LuxuryTemplate,
  marketplace: MarketplaceTemplate,
};
