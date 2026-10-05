// Parsed server-side from the request's own User-Agent header — never
// trusted from the client body, same principle as every other
// client-can't-be-trusted value in this app (price, discount, stock).
// Deliberately a simple heuristic, not a full UA-parsing library: this
// only needs a 3-way bucket for a dashboard chart, not device/browser/OS
// detail.
export type DeviceType = "mobile" | "desktop" | "tablet";

export function parseDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}
