import { z } from "zod";
import { SECTION_TYPES, type SectionType } from "./types";

// Deliberately small: these 4 section types stay data-driven (real orders/
// reviews/products), not merchant-authored CMS content, so their settings
// are display/labeling knobs, not a page-builder content model. This is the
// seam future section types (banner, richtext, image-with-text) would plug
// into later without a schema change to StoreSection itself.
export const statsSettingsSchema = z.object({
  showRating: z.boolean().default(true),
});
export const productsSettingsSchema = z.object({
  title: z.string().max(60).optional(),
});
export const testimonialsSettingsSchema = z.object({
  title: z.string().max(60).optional(),
  limit: z.number().int().min(1).max(12).default(6),
});
export const newsletterSettingsSchema = z.object({
  heading: z.string().max(60).optional(),
  body: z.string().max(160).optional(),
});

export const SECTION_SCHEMAS = {
  stats: statsSettingsSchema,
  products: productsSettingsSchema,
  testimonials: testimonialsSettingsSchema,
  newsletter: newsletterSettingsSchema,
} as const;

export type StatsSettings = z.infer<typeof statsSettingsSchema>;
export type ProductsSettings = z.infer<typeof productsSettingsSchema>;
export type TestimonialsSettings = z.infer<typeof testimonialsSettingsSchema>;
export type NewsletterSettings = z.infer<typeof newsletterSettingsSchema>;

// Parses (and fills in defaults for) an unknown settings blob against a
// concrete schema — used both server-side (save route) and client-side
// (the section components themselves), so a malformed/legacy settings JSON
// never crashes rendering, it just falls back to that type's defaults.
// Takes the schema directly (not a SECTION_SCHEMAS lookup key) so TS infers
// the return type from the call site cleanly, without the generic-indexed-
// access inference TypeScript struggles with across a union of Zod schemas.
export function safeParseSettings<T extends z.ZodTypeAny>(schema: T, settings: unknown): z.infer<T> {
  const result = schema.safeParse(settings ?? {});
  return result.success ? result.data : schema.parse({});
}

// Validates a client-sent sections[] payload before it's persisted — never
// trust client JSON blindly (same principle this codebase already applies
// to order prices/discounts). Unknown types are dropped rather than
// rejecting the whole save; each entry's settings are parsed against its
// own type's schema, filling in defaults for anything missing/invalid.
// Position is always the array index, not client-supplied, so a save can
// never produce gaps/duplicates/out-of-range positions.
export function parseSectionsPayload(raw: unknown): { type: SectionType; enabled: boolean; settings: unknown }[] {
  if (!Array.isArray(raw)) return [];
  const result: { type: SectionType; enabled: boolean; settings: unknown }[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const { type, enabled, settings } = entry as Record<string, unknown>;
    if (typeof type !== "string" || !(SECTION_TYPES as readonly string[]).includes(type)) continue;
    const sectionType = type as SectionType;
    result.push({
      type: sectionType,
      enabled: enabled !== false,
      settings: safeParseSettings(SECTION_SCHEMAS[sectionType], settings),
    });
  }
  return result;
}
