// Ported verbatim from the original marsa-backend/src/routes/stores.js —
// supports Arabic slugs (؀-ۿ) alongside Latin/numeric characters,
// since store names are usually entered in Arabic.
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^؀-ۿa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    // Collapses a run of hyphens left behind by stripped characters (e.g.
    // a name with an emoji in the middle) into one, then strips any
    // leading/trailing hyphen — including one newly exposed by the
    // length cut below, so this must run after it, not just once before.
    // A name ending in an emoji (confirmed live: "Nova filters 💕") used
    // to produce a slug ending in "-", an unusual-looking hostname label
    // once that slug becomes a {slug}.rifqa.ly subdomain.
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}
