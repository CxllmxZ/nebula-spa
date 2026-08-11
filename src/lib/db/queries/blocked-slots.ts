/**
 * Blocked slots queries.
 * One-off date/time blocks (สงกรานต์, ปีใหม่, ปิดปรับปรุง).
 * Recurring patterns = out of MVP scope.
 */

import { asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { blockedSlots } from "@/lib/db/schema";
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
