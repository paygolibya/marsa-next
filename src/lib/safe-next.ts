// Where to send someone after login when the link they opened carried a
// ?next= (e.g. a payment link sent on WhatsApp: rifqa.ly/payment?period=1m
// → /login?next=…). Only same-site paths are accepted — never "//evil.com"
// or "https://…" — so ?next= can't be used as an open redirect.
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
