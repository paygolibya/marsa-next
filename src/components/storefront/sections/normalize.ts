import { normalizeSectionOrder } from "@/components/storefront/templates/types";
import type { SectionData, SectionType } from "./types";

type LegacyCustomization = {
  sectionOrder: string[] | null | undefined;
  showSocialProof: boolean;
  showTestimonials: boolean;
  showNewsletter: boolean;
};

type StoredSection = {
  id: string;
  type: string;
  position: number;
  enabled: boolean;
  settings: unknown;
};

// The one place the "real StoreSection rows, or fall back to synthesizing
// from the legacy sectionOrder/show* fields" rule lives — see the
// StoreSection model comment in schema.prisma. Called server-side
// (GET /api/stores/public/[slug]) so the API always returns a complete,
// ready `sections` array; templates and the editor never need to know a
// fallback path exists at all.
export function normalizeToSections(storedSections: StoredSection[], legacy: LegacyCustomization): SectionData[] {
  if (storedSections.length > 0) {
    return [...storedSections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, type: s.type as SectionType, position: s.position, enabled: s.enabled, settings: s.settings }));
  }

  const legacyEnabled: Record<SectionType, boolean> = {
    stats: legacy.showSocialProof,
    products: true, // no legacy toggle for this one — always shown
    testimonials: legacy.showTestimonials,
    newsletter: legacy.showNewsletter,
  };

  return normalizeSectionOrder(legacy.sectionOrder).map((type, position) => ({
    type,
    position,
    enabled: legacyEnabled[type],
    settings: {},
  }));
}
