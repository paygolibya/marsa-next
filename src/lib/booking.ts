// Shared between the public availability endpoint (which lists open slots
// for a date) and order creation (which re-validates a submitted slot
// server-side rather than trusting the client blindly) — both must agree
// on the exact same grid, or a slot the availability endpoint offered
// could be rejected at checkout.
//
// Deliberate simplification (documented on Store.bookingWorkingHours in
// schema.prisma too): no timezone handling. A working-hours time like
// "09:00" is treated as the literal UTC hour/minute of the stored Date —
// not real UTC, just an internally-consistent convention, since every
// merchant and buyer this platform serves is in Libya (a single,
// DST-free timezone). The storefront checkout UI must display slot times
// by slicing the ISO string's UTC HH:MM directly (not toLocaleTimeString,
// which would apply the browser's real timezone and introduce a skew).

export type WorkingHours = Record<string, { open: string; close: string } | null | undefined>;

function parseHHMM(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Every slot start, in minutes-from-midnight, for one weekday (0=Sunday).
export function generateDaySlotMinutes(workingHours: WorkingHours | null | undefined, weekday: number, slotMinutes: number): number[] {
  if (!workingHours || slotMinutes <= 0) return [];
  const day = workingHours[String(weekday)];
  if (!day) return [];
  const open = parseHHMM(day.open);
  const close = parseHHMM(day.close);
  if (open === null || close === null || close <= open) return [];
  const slots: number[] = [];
  for (let t = open; t + slotMinutes <= close; t += slotMinutes) slots.push(t);
  return slots;
}

// All open slot start times (as Date objects) for one calendar date —
// excludes slots already taken (by storeId, scheduledStartAt match) and,
// for today, slots that have already passed.
export function generateAvailableSlots(
  date: Date,
  workingHours: WorkingHours | null | undefined,
  slotMinutes: number,
  takenStartTimes: Date[],
  now: Date
): Date[] {
  const weekday = date.getUTCDay();
  const dayMinutes = generateDaySlotMinutes(workingHours, weekday, slotMinutes);
  const taken = new Set(takenStartTimes.map((d) => d.getTime()));

  return dayMinutes
    .map((minutesFromMidnight) => {
      const slot = new Date(date);
      slot.setUTCHours(0, 0, 0, 0);
      slot.setUTCMinutes(minutesFromMidnight);
      return slot;
    })
    .filter((slot) => slot.getTime() > now.getTime() && !taken.has(slot.getTime()));
}

// Re-validates a specific slot server-side at order-creation time — never
// trust that a client-submitted scheduledStartAt actually came from the
// availability endpoint's own output.
export function isSlotOpen(slotStart: Date, workingHours: WorkingHours | null | undefined, slotMinutes: number): boolean {
  const weekday = slotStart.getUTCDay();
  const minutesFromMidnight = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
  if (slotStart.getUTCSeconds() !== 0 || slotStart.getUTCMilliseconds() !== 0) return false;
  return generateDaySlotMinutes(workingHours, weekday, slotMinutes).includes(minutesFromMidnight);
}
