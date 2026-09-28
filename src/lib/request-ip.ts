// Shared by every route that rate-limits per IP (register, login) — kept
// in one place so the two never drift on how they read it.
export function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() : null;
}
