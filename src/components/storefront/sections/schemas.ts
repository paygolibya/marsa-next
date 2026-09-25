import { z } from "zod";

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
