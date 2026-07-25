// Ported verbatim from the original marsa-backend/src/routes/stores.js —
// supports Arabic slugs (\u0600-\u06FF) alongside Latin/numeric characters,
// since store names are usually entered in Arabic.
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
