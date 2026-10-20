/**
 * Blocked slots queries.
 * One-off date/time blocks (สงกรานต์, ปีใหม่, ปิดปรับปรุง).
 * Recurring patterns = out of MVP scope.
 */

import { and, asc, eq, gt, gte, lt, notInArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blockedSlots, bookings } from "@/lib/db/schema";
import type { BlockedSlot } from "@/lib/db/schema";

/**
 * Upcoming blocked slots (endsAt >= now).
 * Sort ASC by startsAt for chronological display.
 * Past slots = noise, filtered out.
 */
export async function getUpcomingBlockedSlots(): Promise<BlockedSlot[]> {
  const db = await getDb();
  const now = new Date();
  return db
    .select()
    .from(blockedSlots)
    .where(gte(blockedSlots.endsAt, now))
    .orderBy(asc(blockedSlots.startsAt));
}

export interface CreateBlockedSlotInput {
  startsAt: Date;
  endsAt: Date;
  reason?: string | null;
}

export async function createBlockedSlot(
  input: CreateBlockedSlotInput,
): Promise<BlockedSlot> {
  const db = await getDb();
  const [created] = await db
    .insert(blockedSlots)
    .values({
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason ?? null,
    })
    .returning();
  return created;
}

export interface OverlappingBooking {
  code: string;
  customerName: string;
  customerPhone: string;
  startsAt: Date;
}

/**
 * คิวที่ยังใช้งาน (ไม่นับ cancelled / no-show) ที่ทับช่วง [start, end)
 * ใช้เตือนก่อนเพิ่มวันหยุด — ไม่ยกเลิกให้อัตโนมัติ (ร้านติดต่อลูกค้าเอง)
 */
export async function getOverlappingBookings(
  start: Date,
  end: Date,
): Promise<OverlappingBooking[]> {
  const db = await getDb();
  return db
    .select({
      code: bookings.code,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .where(
      and(
        lt(bookings.startsAt, end),
        gt(bookings.endsAt, start),
        notInArray(bookings.status, ["cancelled", "no-show"]),
      ),
    )
    .orderBy(asc(bookings.startsAt));
}

/**
 * Delete a blocked slot by id.
 * Returns true if deleted, false if not found.
 */
export async function deleteBlockedSlot(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(blockedSlots)
    .where(eq(blockedSlots.id, id))
    .returning({ id: blockedSlots.id });
  return result.length > 0;
}
