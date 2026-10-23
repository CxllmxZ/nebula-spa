/**
 * Business hours queries.
 * Schema constraint: unique(dayOfWeek) — 1 row per day (0-6).
 */

import { and, asc, gte, inArray, notInArray } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { getDb } from "@/lib/db";
import { bookings, businessHours } from "@/lib/db/schema";
import type { BusinessHour } from "@/lib/db/schema";
import { BANGKOK_TZ } from "@/lib/datetime";

/**
 * Fetch all 7 rows (Sun-Sat).
 *
 * If DB is missing rows (edge case: empty seed) — auto-fill with defaults
 * (all closed) so UI always has 7 rows to render.
 *
 * Sorted by dayOfWeek ascending (Sun=0 first).
 */
export async function getAllHours(): Promise<BusinessHour[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(businessHours)
    .orderBy(asc(businessHours.dayOfWeek));

  // Fill missing days with closed defaults
  const byDay = new Map(rows.map((r) => [r.dayOfWeek, r]));
  const complete: BusinessHour[] = [];
  for (let day = 0; day < 7; day++) {
    const existing = byDay.get(day);
    if (existing) {
      complete.push(existing);
    } else {
      complete.push({
        id: -1, // Placeholder (won't collide — real ids > 0)
        dayOfWeek: day,
        openTime: null,
        closeTime: null,
        isClosed: true,
      });
    }
  }
  return complete;
}

export interface HourRow {
  dayOfWeek: number; // 0-6
  openTime: string | null; // "HH:MM" or null
  closeTime: string | null;
  isClosed: boolean;
}

/**
 * Replace all 7 rows atomically.
 *
 * Strategy: delete-all + insert-all inside single transaction.
 * D1 supports transactions via db.batch() for atomicity.
 *
 * Validation caller responsibility (schema-level: 7 rows, all days 0-6 unique).
 */
export async function updateAllHours(rows: HourRow[]): Promise<BusinessHour[]> {
  const db = await getDb();

  // Sanity: caller should send 7 rows covering 0-6, but guard here too
  const days = new Set(rows.map((r) => r.dayOfWeek));
  if (rows.length !== 7 || days.size !== 7) {
    throw new Error(
      `updateAllHours requires exactly 7 rows covering days 0-6 (got ${rows.length} rows, ${days.size} unique days)`,
    );
  }

  // D1 batch: [delete, ...inserts] — atomic
  await db.batch([
    db
      .delete(businessHours)
      .where(inArray(businessHours.dayOfWeek, [0, 1, 2, 3, 4, 5, 6])),
    ...rows.map((r) =>
      db.insert(businessHours).values({
        dayOfWeek: r.dayOfWeek,
        openTime: r.isClosed ? null : r.openTime,
        closeTime: r.isClosed ? null : r.closeTime,
        isClosed: r.isClosed,
      }),
    ),
  ]);

  return getAllHours();
}

export interface AffectedBooking {
  code: string;
  customerName: string;
  customerPhone: string;
  startsAt: Date;
}

type DayHours = {
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
};

/** คิวนี้อยู่ในเวลาเปิดของวันนั้นไหม (เทียบ "HH:MM" แบบ string ได้ เพราะเลขเติม 0 ครบ) */
function fitsHours(
  h: DayHours | undefined,
  start: string,
  end: string,
): boolean {
  if (!h || h.isClosed || !h.openTime || !h.closeTime) return false;
  return start >= h.openTime && end <= h.closeTime;
}

/**
 * คิวในอนาคตที่ "เคยอยู่ในเวลาเปิด แต่จะหลุดออกนอกเวลาใหม่"
 * ใช้เตือนก่อนบันทึกเวลาทำการ — ไม่ยกเลิกคิวให้อัตโนมัติ (ร้านติดต่อลูกค้าเอง)
 *
 * นับเฉพาะคิวที่ได้รับผลจากการเปลี่ยนครั้งนี้ — คิวที่อยู่นอกเวลาอยู่แล้ว
 * (เช่น admin ลงให้พิเศษ) จะไม่ถูกเตือนซ้ำทุกครั้งที่กดบันทึก
 */
export async function getBookingsAffectedByHours(
  newRows: HourRow[],
): Promise<AffectedBooking[]> {
  const db = await getDb();
  const [oldRows, upcoming] = await Promise.all([
    getAllHours(),
    db
      .select({
        code: bookings.code,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.startsAt, new Date()),
          notInArray(bookings.status, ["cancelled", "no-show"]),
        ),
      )
      .orderBy(asc(bookings.startsAt)),
  ]);

  const oldByDay = new Map(oldRows.map((r) => [r.dayOfWeek, r]));
  const newByDay = new Map(newRows.map((r) => [r.dayOfWeek, r]));

  return upcoming
    .filter((b) => {
      // "i" = ISO วันในสัปดาห์ 1(จ.)–7(อา.) → % 7 ให้ตรงกับ schema (อา.=0)
      const day = Number(formatInTimeZone(b.startsAt, BANGKOK_TZ, "i")) % 7;
      const start = formatInTimeZone(b.startsAt, BANGKOK_TZ, "HH:mm");
      const end = formatInTimeZone(b.endsAt, BANGKOK_TZ, "HH:mm");
      return (
        fitsHours(oldByDay.get(day), start, end) &&
        !fitsHours(newByDay.get(day), start, end)
      );
    })
    .map((b) => ({
      code: b.code,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      startsAt: b.startsAt,
    }));
}
