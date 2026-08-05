import { and, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bookings,
  businessHours,
  services,
  blockedSlots,
} from "@/lib/db/schema";
import {
  bangkokDateTimeToUtc,
  getBangkokDayOfWeek,
  getBangkokNow,
  isBangkokToday,
  addMinutesToTime,
  isTimeBeforeOrEqual,
} from "@/lib/datetime";

/**
 * Represents an available time slot.
 * start = booking start time (UTC internal, ISO at API boundary)
 * end   = start + service duration
 */
export type SlotRange = {
  start: Date;
  end: Date;
};

/**
 * Maximum days in advance a customer can book.
 * Handled here (availability layer) — return [] if date > today + this
 */
const ADVANCE_BOOKING_DAYS = 30;

/**
 * Slot grid granularity in minutes.
 * 30-min covers all current service durations (30/45/60/90/120)
 */
const SLOT_GRANULARITY_MIN = 30;

/**
 * Statuses that block a slot from being available.
 * Only 'confirmed' — pending doesn't exist in current auto-confirm flow.
 * If future flow adds pending-approval, decide business rule:
 *   - Block immediately + auto-expire?
 *   - Or use separate reservation table to isolate spam risk?
 */
const BLOCKING_STATUSES = ["confirmed"] as const;

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Compute available time slots for a service on a specific date.
 *
 * @param serviceId - ID of the service to book
 * @param date - "YYYY-MM-DD" (Bangkok calendar date)
 * @returns Array of available slots. Empty if:
 *   - service not found or inactive
 *   - day is closed
 *   - date is beyond advance booking limit
 *   - date is in the past
 *   - no slots fit business hours + duration
 */
export async function getAvailableSlots(
  serviceId: number,
  date: string,
): Promise<SlotRange[]> {
  const db = await getDb();

  // ─── Step 1: Guard advance booking limit ───────────────────
  if (isBeyondAdvanceLimit(date) || isPastDate(date)) {
    return [];
  }

  // ─── Step 2: Fetch service (must exist + active) ──────────
  const [service] = await db
    .select({ durationMin: services.durationMin })
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.isActive, true)))
    .limit(1);

  if (!service) return [];

  // ─── Step 3: Fetch business hours for the day-of-week ─────
  const dayOfWeek = getBangkokDayOfWeek(date);
  const [hours] = await db
    .select()
    .from(businessHours)
    .where(eq(businessHours.dayOfWeek, dayOfWeek))
    .limit(1);

  if (!hours || hours.isClosed || !hours.openTime || !hours.closeTime) {
    return [];
  }

  // ─── Step 4: Fetch existing bookings on this date ─────────
  const dayStart = bangkokDateTimeToUtc(date, "00:00");
  const dayEnd = bangkokDateTimeToUtc(date, "23:59");

  const existing = await db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        gte(bookings.startsAt, dayStart),
        lte(bookings.startsAt, dayEnd),
        inArray(bookings.status, [...BLOCKING_STATUSES]),
      ),
    );

  // ─── Step 5: Fetch blocked slots on this date ─────────────
  const blocked = await db
    .select({ startsAt: blockedSlots.startsAt, endsAt: blockedSlots.endsAt })
    .from(blockedSlots)
    .where(
      and(
        gte(blockedSlots.startsAt, dayStart),
        lte(blockedSlots.startsAt, dayEnd),
      ),
    );

  // ─── Step 6: Generate 30-min grid + filter ────────────────
  const candidates = generateSlotGrid(
    date,
    hours.openTime,
    hours.closeTime,
    service.durationMin,
  );

  const now = getBangkokNow();
  const isToday = isBangkokToday(date);

  return candidates.filter((slot) => {
    // 6a: Skip past slots if today
    if (isToday && slot.start <= now) return false;

    // 6b: No overlap with existing booking
    if (hasOverlap(slot, existing)) return false;

    // 6c: No overlap with blocked slot
    if (hasOverlap(slot, blocked)) return false;

    return true;
  });
}

/**
 * Check if a proposed booking time conflicts with existing bookings.
 * Reused by createBooking() (Session 6) for race-condition guard.
 *
 * @returns true if conflict exists (should reject booking)
 */
export async function hasBookingConflict(
  startsAt: Date,
  endsAt: Date,
): Promise<boolean> {
  // Convert Date → Unix seconds manually for raw SQL template
  // (lt() auto-serializes, but sql`` does not — session 5 gotcha)
  const startsAtSec = Math.floor(startsAt.getTime() / 1000);
  const db = await getDb();

  const [conflict] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        lt(bookings.startsAt, endsAt),
        // Drizzle doesn't have gt() shorthand for timestamp — use raw comparison.
        // Must pass Unix seconds (not Date) because sql`` doesn't serialize.
        sql`${bookings.endsAt} > ${startsAtSec}`,
        inArray(bookings.status, [...BLOCKING_STATUSES]),
      ),
    )
    .limit(1);

  return !!conflict;
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Returns true if the date is more than ADVANCE_BOOKING_DAYS from today.
 */
function isBeyondAdvanceLimit(date: string): boolean {
  const requestDate = bangkokDateTimeToUtc(date, "00:00");
  const maxDate = bangkokDateTimeToUtc(
    formatDateOffset(ADVANCE_BOOKING_DAYS),
    "00:00",
  );
  return requestDate > maxDate;
}

/**
 * Returns true if the date is before today (Bangkok calendar).
 */
function isPastDate(date: string): boolean {
  const requestDate = bangkokDateTimeToUtc(date, "00:00");
  const todayStart = bangkokDateTimeToUtc(formatDateOffset(0), "00:00");
  return requestDate < todayStart;
}

/**
 * Get YYYY-MM-DD string offset days from today (Bangkok calendar).
 */
function formatDateOffset(daysOffset: number): string {
  const now = getBangkokNow();
  const target = new Date(now.getTime() + daysOffset * 24 * 60 * 60 * 1000);
  // Format in Bangkok timezone
  const bangkokDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
  return bangkokDate; // en-CA locale → "YYYY-MM-DD"
}

/**
 * Generate 30-min slot candidates from open_time up to close_time,
 * where slot.end fits within close_time.
 */
function generateSlotGrid(
  date: string,
  openTime: string,
  closeTime: string,
  durationMin: number,
): SlotRange[] {
  const slots: SlotRange[] = [];
  let candidateTime = openTime; // "HH:MM"

  while (true) {
    const endTime = addMinutesToTime(candidateTime, durationMin);

    // Slot end must fit within close time
    if (!isTimeBeforeOrEqual(endTime, closeTime)) break;

    slots.push({
      start: bangkokDateTimeToUtc(date, candidateTime),
      end: bangkokDateTimeToUtc(date, endTime),
    });

    candidateTime = addMinutesToTime(candidateTime, SLOT_GRANULARITY_MIN);

    // Safety guard: prevent infinite loop if grid crosses midnight
    if (slots.length > 100) break;
  }

  return slots;
}

/**
 * Check if a slot overlaps with any range in the list.
 * Overlap: slot.start < range.end AND slot.end > range.start
 */
function hasOverlap(
  slot: SlotRange,
  ranges: { startsAt: Date; endsAt: Date }[],
): boolean {
  return ranges.some((r) => slot.start < r.endsAt && slot.end > r.startsAt);
}
