/**
 * Business hours queries.
 * Schema constraint: unique(dayOfWeek) — 1 row per day (0-6).
 */

import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { businessHours } from "@/lib/db/schema";
import type { BusinessHour } from "@/lib/db/schema";

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
