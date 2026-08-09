/**
 * Service queries.
 * Business logic layer — no HTTP concerns.
 */

import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import type { Service } from "@/lib/db/schema";

/**
 * Fetch active services — for filter dropdowns, booking form.
 * Sort by name for stable UX (SELECT order should be deterministic).
 */
export async function getActiveServices(): Promise<Service[]> {
  const db = await getDb();
  return db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.name));
}
