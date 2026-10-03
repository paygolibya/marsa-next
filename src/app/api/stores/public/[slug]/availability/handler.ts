import { NextResponse } from "next/server";
import { generateAvailableSlots, type WorkingHours } from "@/lib/booking";

export type AvailabilityDb = {
  store: {
    findUnique: (args: { where: { slug: string } }) => Promise<{
      id: string;
      type: string;
      bookingSlotMinutes: number | null;
      bookingWorkingHours: unknown;
    } | null>;
  };
  order: {
    findMany: (args: {
      where: { storeId: string; scheduledKind: "booking"; scheduledStartAt: { gte: Date; lt: Date } };
      select: { scheduledStartAt: true };
    }) => Promise<{ scheduledStartAt: Date | null }[]>;
  };
};

// GET /api/stores/public/:slug/availability?date=YYYY-MM-DD — public, no
// auth. Returns the open appointment slots for one calendar date on a
// booking store (store.type === "booking"), computed from the merchant's
// own working-hours/slot-length settings minus already-booked slots and
// (for today) slots already in the past. The checkout page displays
// exactly these ISO strings and sends the chosen one back verbatim as
// scheduledStartAt — see src/lib/booking.ts's module comment for why no
// client-side date/time math happens at all.
export async function handleGetAvailability(db: AvailabilityDb, req: Request, slug: string): Promise<Response> {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "معلمة date مطلوبة بصيغة YYYY-MM-DD" }, { status: 400 });
  }
  const date = new Date(`${dateParam}T00:00:00.000Z`);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "تاريخ غير صالح" }, { status: 400 });
  }

  const store = await db.store.findUnique({ where: { slug } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });
  if (store.type !== "booking") {
    return NextResponse.json({ error: "هذا المتجر لا يدعم الحجز بالمواعيد" }, { status: 400 });
  }

  const slotMinutes = store.bookingSlotMinutes ?? 0;
  const workingHours = store.bookingWorkingHours as WorkingHours | null;

  const dayEnd = new Date(date);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const existing = await db.order.findMany({
    where: { storeId: store.id, scheduledKind: "booking", scheduledStartAt: { gte: date, lt: dayEnd } },
    select: { scheduledStartAt: true },
  });
  const taken = existing.map((o) => o.scheduledStartAt).filter((d): d is Date => d !== null);

  const slots = generateAvailableSlots(date, workingHours, slotMinutes, taken, new Date());

  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}
