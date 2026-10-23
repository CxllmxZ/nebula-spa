import { and, eq, gt, lt, sql, notInArray } from "drizzle-orm";
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
// จองล่วงหน้าได้กี่วัน — availability layer คืน [] ถ้าเกินวันนี้ + ค่านี้
import { ADVANCE_BOOKING_DAYS } from "@/lib/booking-rules";

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
const NON_BLOCKING_STATUSES = ["cancelled", "no-show"] as const;
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

  // ─── Step 4: Fetch existing bookings that overlap this date ─
  // ช่วงวัน = [00:00 วันนี้, 00:00 วันถัดไป) — ไม่ใช้ "23:59:59"
  // เพราะ bangkokDateTimeToUtc รับแค่ HH:MM → ส่งวินาทีเข้าไปได้ Invalid Date
  // (bug Day 31→38: query ได้ 0 แถว → วันหยุดพิเศษ + คิวเดิมไม่ถูกกรองออก)
  const dayStart = bangkokDateTimeToUtc(date, "00:00");
  const nextDayStart = bangkokDateTimeToUtc(addDays(date, 1), "00:00");

  const existing = await db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        lt(bookings.startsAt, nextDayStart),
        gt(bookings.endsAt, dayStart),
        notInArray(bookings.status, [...NON_BLOCKING_STATUSES]),
      ),
    );

  // ─── Step 5: Fetch blocked slots that overlap this date ───
  // "ทับวันนี้" ไม่ใช่ "เริ่มวันนี้" → ครอบวันหยุดที่เริ่มเมื่อวาน/หลายวันติดกัน
  const blocked = await db
    .select({ startsAt: blockedSlots.startsAt, endsAt: blockedSlots.endsAt })
    .from(blockedSlots)
    .where(
      and(
        lt(blockedSlots.startsAt, nextDayStart),
        gt(blockedSlots.endsAt, dayStart),
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
        notInArray(bookings.status, [...NON_BLOCKING_STATUSES]),
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

// ─────────────────────────────────────────────────────────────
// Day closures — กฎ "วันไหนร้านปิดทั้งวัน" ที่เดียวของทั้งระบบ
// ใช้โดย: หน้าจอง (ปฏิทิน + ข้อความ), แจ้งกลุ่ม LINE, สรุปเช้า
// ─────────────────────────────────────────────────────────────

export type DayClosure =
  | { reason: "weekly"; label: string } // label = ชื่อวัน เช่น "เสาร์"
  | { reason: "holiday"; label: string | null }; // label = เหตุผลที่ร้านใส่

const THAI_WEEKDAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
];

/**
 * วันที่ร้านปิดทั้งวัน ในช่วง [fromDate, fromDate + days)
 *
 * ปิดทั้งวัน เมื่ออย่างใดอย่างหนึ่ง:
 *   1. เวลาทำการวันนั้นปิด (is_closed หรือไม่มีเวลาเปิด-ปิด)
 *   2. มีวันหยุดพิเศษ 1 รายการที่ครอบเวลาเปิดทั้งหมด
 * ปิดแค่บางช่วง = ร้านยังเปิด
 *
 * ข้อจำกัด: ดูทีละรายการ — วันหยุดหลายช่วงต่อกันจนเต็มวัน ยังนับว่าเปิด
 *
 * Query 2 ครั้งไม่ว่าช่วงยาวแค่ไหน (เวลาทำการ 7 แถว + วันหยุดในช่วง)
 *
 * @returns map "YYYY-MM-DD" → เหตุผล (วันที่ไม่อยู่ใน map = เปิด)
 */
export async function getClosuresInRange(
  fromDate: string,
  days: number,
): Promise<Record<string, DayClosure>> {
  const db = await getDb();
  const rangeStart = bangkokDateTimeToUtc(fromDate, "00:00");
  const rangeEnd = bangkokDateTimeToUtc(addDays(fromDate, days), "00:00");

  const [allHours, blocks] = await Promise.all([
    db.select().from(businessHours),
    db
      .select({
        startsAt: blockedSlots.startsAt,
        endsAt: blockedSlots.endsAt,
        reason: blockedSlots.reason,
      })
      .from(blockedSlots)
      .where(
        and(
          lt(blockedSlots.startsAt, rangeEnd),
          gt(blockedSlots.endsAt, rangeStart),
        ),
      ),
  ]);

  const hoursByDay = new Map(allHours.map((h) => [h.dayOfWeek, h]));
  const result: Record<string, DayClosure> = {};

  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const dow = getBangkokDayOfWeek(date);
    const hours = hoursByDay.get(dow);

    if (!hours || hours.isClosed || !hours.openTime || !hours.closeTime) {
      result[date] = { reason: "weekly", label: THAI_WEEKDAYS[dow] };
      continue;
    }

    const openAt = bangkokDateTimeToUtc(date, hours.openTime);
    const closeAt = bangkokDateTimeToUtc(date, hours.closeTime);
    const fullDay = blocks.find(
      (b) => b.startsAt <= openAt && b.endsAt >= closeAt,
    );
    if (fullDay) {
      result[date] = { reason: "holiday", label: fullDay.reason };
    }
  }

  return result;
}

/** วันนั้นร้านปิดทั้งวันไหม — null = เปิด */
export async function getDayClosure(date: string): Promise<DayClosure | null> {
  const closures = await getClosuresInRange(date, 1);
  return closures[date] ?? null;
}

/** "YYYY-MM-DD" + n วัน (วันปฏิทิน ไม่มี timezone) */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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
