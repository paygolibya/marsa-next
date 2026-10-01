// Ported verbatim from the original marsa-backend/src/routes/stores.js —
// supports Arabic slugs (؀-ۿ) alongside Latin/numeric characters,
// since store names are usually entered in Arabic.
export function slugify(name: string): string {
  const cleaned = collapseHyphens(
    name
      .trim()
      .toLowerCase()
      .replace(/[^؀-ۿa-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
  );

  // A slug becomes the label of a real {slug}.rifqa.ly hostname, which
  // IDNA-encodes it — and IDNA rejects a label mixing Arabic letters
  // with Latin letters outright, confirmed directly against a real URL
  // parser for every combination tried (Arabic+Latin, Latin+Arabic, even
  // a single stray Latin letter). Digits mix fine with either script. A
  // genuinely bilingual name (found live: a real store named "نعيم
  // store") would otherwise produce a slug no browser can ever open
  // ("Invalid URL"), not just an unusual-looking one — so if both
  // scripts are present, the Latin letters are dropped in favor of the
  // Arabic, matching this function's own original premise above that
  // Arabic is the primary case.
  const hasArabic = /[؀-ۿ]/.test(cleaned);
  const hasLatinLetter = /[a-z]/.test(cleaned);
  const scriptSafe = hasArabic && hasLatinLetter ? collapseHyphens(cleaned.replace(/[a-z]/g, "")) : cleaned;

  // Trimmed again after the length cut — the cut itself can expose a new
  // trailing hyphen.
  return scriptSafe.slice(0, 60).replace(/^-+|-+$/g, "");
}

function collapseHyphens(s: string): string {
  return s.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
