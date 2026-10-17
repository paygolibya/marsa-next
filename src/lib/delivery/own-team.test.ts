import test from "node:test";
import assert from "node:assert/strict";
import { promisedDeliveryBy, quoteOwnTeamDelivery, resolveDeliveryProvider, resolveServiceLevel, tripoliDateKey } from "./own-team";

// Africa/Tripoli is UTC+2 (no DST), so 13:59 Tripoli = 11:59Z.
const tripoli = (hhmm: string, day = "2026-10-17") => new Date(`${day}T${hhmm}:00+02:00`);

test("Tripoli in Arabic routes to the own team", () => {
  assert.equal(resolveDeliveryProvider({ city: "طرابلس" }), "OWN_TEAM");
  assert.equal(resolveDeliveryProvider({ city: "طرابلس - بن عاشور" }), "OWN_TEAM");
  assert.equal(resolveDeliveryProvider({ city: "  طَرابُلس " }), "OWN_TEAM");
});

test("Tripoli in English routes to the own team", () => {
  assert.equal(resolveDeliveryProvider({ city: "Tripoli" }), "OWN_TEAM");
  assert.equal(resolveDeliveryProvider({ city: "TRIPOLI" }), "OWN_TEAM");
  assert.equal(resolveDeliveryProvider({ city: "Tarabulus" }), "OWN_TEAM");
});

test("every Greater-Tripoli Vanex city routes to the own team", () => {
  for (const city of [
    "طرابلس تسليم نسائي",
    "سوبر فانكس طرابلس",
    "التخزين الأمن - طرابلس",
    "جنزور",
    "جنزور - الغيران",
    "تاجوراء",
    "Janzour",
    "Tajoura",
    "تسليم بفرع السراج",
    "تسليم بفرع عين زارة",
    "تسليم بفرع حي الاندلس",
  ]) {
    assert.equal(resolveDeliveryProvider({ city }), "OWN_TEAM", city);
  }
});

test("Benghazi and Misrata stay with Vanex", () => {
  assert.equal(resolveDeliveryProvider({ city: "بنغازي" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "Benghazi" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "مصراتة" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "Misrata" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "التخزين الأمن - بنغازي" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "تسليم بفرع مصراتة" }), "VANEX");
});

test("an area named after Tripoli in another city does not count", () => {
  assert.equal(resolveDeliveryProvider({ city: "مصراتة - طريق طرابلس" }), "VANEX");
});

test("an empty city stays with Vanex", () => {
  assert.equal(resolveDeliveryProvider({ city: "" }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: null }), "VANEX");
  assert.equal(resolveDeliveryProvider({ city: "   " }), "VANEX");
});

test("13:59 Tripoli → SAME_DAY, 15 LYD, by 21:00 today", () => {
  const quote = quoteOwnTeamDelivery(tripoli("13:59"));
  assert.equal(quote.level, "SAME_DAY");
  assert.equal(quote.feeCents, 1500);
  assert.equal(quote.promisedBy.toISOString(), tripoli("21:00").toISOString());
});

test("14:00 Tripoli → NEXT_MORNING, 10 LYD, by 12:00 tomorrow", () => {
  const quote = quoteOwnTeamDelivery(tripoli("14:00"));
  assert.equal(quote.level, "NEXT_MORNING");
  assert.equal(quote.feeCents, 1000);
  assert.equal(quote.promisedBy.toISOString(), tripoli("12:00", "2026-10-18").toISOString());
});

test("20:59, 21:00 and 23:30 Tripoli → NEXT_MORNING by 12:00 tomorrow", () => {
  for (const time of ["20:59", "21:00", "23:30"]) {
    const quote = quoteOwnTeamDelivery(tripoli(time));
    assert.equal(quote.level, "NEXT_MORNING", time);
    assert.equal(quote.feeCents, 1000, time);
    assert.equal(quote.promisedBy.toISOString(), tripoli("12:00", "2026-10-18").toISOString(), time);
  }
});

test("service level uses Tripoli time, not UTC (23:30 Tripoli is 21:30Z on the same day)", () => {
  assert.equal(resolveServiceLevel(new Date("2026-10-17T11:59:00Z")), "SAME_DAY"); // 13:59 Tripoli
  assert.equal(resolveServiceLevel(new Date("2026-10-17T12:00:00Z")), "NEXT_MORNING"); // 14:00 Tripoli
});

test("just after midnight Tripoli is a new day and still same-day eligible", () => {
  const placed = new Date("2026-10-17T22:30:00Z"); // 00:30 Tripoli on the 18th
  assert.equal(tripoliDateKey(placed), "2026-10-18");
  assert.equal(resolveServiceLevel(placed), "SAME_DAY");
  assert.equal(promisedDeliveryBy(placed, "SAME_DAY").toISOString(), tripoli("21:00", "2026-10-18").toISOString());
});
