// Tripoli in-house delivery: Greater Tripoli orders are delivered by
// Rifqa's own team, never handed to Vanex; everything else still goes to
// Vanex exactly as before. Pure functions only (no Node/Prisma imports) —
// the checkout page uses the same routing + service-level logic as the
// server so the buyer sees the fee the server will actually charge.

export type DeliveryProvider = "OWN_TEAM" | "VANEX";
export type DeliveryServiceLevel = "SAME_DAY" | "NEXT_MORNING";
export type DeliveryStatus = "PENDING" | "PICKED_UP" | "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED";

export const DELIVERY_STATUSES: DeliveryStatus[] = ["PENDING", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"];

const TRIPOLI_TZ = "Africa/Tripoli";

export const OWN_TEAM_FEE_CENTS: Record<DeliveryServiceLevel, number> = {
  SAME_DAY: 1500,
  NEXT_MORNING: 1000,
};

// Same-day cutoff and promised-by hours, all Africa/Tripoli wall-clock.
const SAME_DAY_CUTOFF_HOUR = 14;
const SAME_DAY_PROMISE_HOUR = 21;
const NEXT_MORNING_PROMISE_HOUR = 12;

export function normalizeCityName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s*[-–—]\s*/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
}

// Any city whose own name mentions Tripoli — covers Vanex's "طرابلس",
// "طرابلس تسليم نسائي", "سوبر فانكس طرابلس" and free-text English input.
const TRIPOLI_NAME_PATTERN = /طرابلس|tripoli|trablus|tarabulus|trabulus/;

// Greater-Tripoli destinations whose Vanex city name doesn't contain the
// word Tripoli: the suburbs Janzour and Tajoura, the Tripoli storage
// option, and Vanex's in-Tripoli branch-pickup "cities".
const TRIPOLI_EXACT_NAMES = new Set(
  [
    "جنزور",
    "janzour",
    "janzur",
    "تاجوراء",
    "تاجورا",
    "tajoura",
    "tajura",
    "tajora",
    "التخزين الأمن - طرابلس",
    "تسليم بفرع سوق الجمعة",
    "تسليم بفرع السراج",
    "تسليم بفرع حي الاندلس",
    "تسليم بفرع زناتة",
    "تسليم بفرع الجرابة",
    "تسليم بفرع عين زارة",
  ].map(normalizeCityName)
);

// `city` is a city name — either a Vanex city's own name or the stored
// Order.buyerCity ("<city>" or "<city> - <area>"). The Tripoli-word match
// only looks at the city part before " - ", so an area elsewhere that
// happens to be named after Tripoli (e.g. "مصراتة - طريق طرابلس") doesn't
// count.
export function resolveDeliveryProvider(order: { city: string | null | undefined }): DeliveryProvider {
  const full = normalizeCityName(order.city);
  if (!full) return "VANEX";
  const cityPart = full.split(" - ")[0];
  if (TRIPOLI_EXACT_NAMES.has(full) || TRIPOLI_EXACT_NAMES.has(cityPart)) return "OWN_TEAM";
  if (TRIPOLI_NAME_PATTERN.test(cityPart)) return "OWN_TEAM";
  return "VANEX";
}

type TripoliClock = { year: number; month: number; day: number; hour: number; minute: number };

function tripoliClock(date: Date): TripoliClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TRIPOLI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  // hour12:false can render midnight as "24" in some ICU builds.
  const hour = get("hour") === 24 ? 0 : get("hour");
  return { year: get("year"), month: get("month"), day: get("day"), hour, minute: get("minute") };
}

// Converts a Tripoli wall-clock time (dayOffset days after `reference`'s
// Tripoli date) to a real instant. Libya has been fixed UTC+2 since 2013,
// but the offset is derived from Intl rather than hardcoded.
function tripoliWallClockToDate(reference: Date, dayOffset: number, hour: number): Date {
  const c = tripoliClock(reference);
  const offsetMs = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute) - Math.floor(reference.getTime() / 60_000) * 60_000;
  return new Date(Date.UTC(c.year, c.month - 1, c.day + dayOffset, hour, 0) - offsetMs);
}

export function tripoliDateKey(date: Date): string {
  const c = tripoliClock(date);
  return `${c.year}-${String(c.month).padStart(2, "0")}-${String(c.day).padStart(2, "0")}`;
}

export function resolveServiceLevel(now: Date): DeliveryServiceLevel {
  return tripoliClock(now).hour < SAME_DAY_CUTOFF_HOUR ? "SAME_DAY" : "NEXT_MORNING";
}

// When an order placed at `placedAt` with `level` is promised by:
// SAME_DAY → 21:00 the same Tripoli day; NEXT_MORNING → 12:00 the next.
export function promisedDeliveryBy(placedAt: Date, level: DeliveryServiceLevel): Date {
  return level === "SAME_DAY"
    ? tripoliWallClockToDate(placedAt, 0, SAME_DAY_PROMISE_HOUR)
    : tripoliWallClockToDate(placedAt, 1, NEXT_MORNING_PROMISE_HOUR);
}

export function quoteOwnTeamDelivery(now: Date): { level: DeliveryServiceLevel; feeCents: number; promisedBy: Date } {
  const level = resolveServiceLevel(now);
  return { level, feeCents: OWN_TEAM_FEE_CENTS[level], promisedBy: promisedDeliveryBy(now, level) };
}

// The buyer-facing courier status string each own-team delivery status
// corresponds to — the same values the Vanex webhook already writes to
// Order.courierStatus, so tracking pages, emails and SMS need no changes.
export const COURIER_STATUS_FOR_DELIVERY_STATUS: Partial<Record<DeliveryStatus, string>> = {
  PICKED_UP: "accepted",
  DELIVERED: "delivered",
  FAILED: "failed_delivery",
};
