/**
 * Service queries.
 * Business logic layer — no HTTP concerns.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import type { Service, NewService } from "@/lib/db/schema";

/**
 * Fetch active services — public API + booking form + admin filter dropdown.
 * Sort by displayOrder then name.
 */
export async function getActiveServices(): Promise<Service[]> {
  const db = await getDb();
  return db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.displayOrder), asc(services.name));
}

/**
 * Fetch all services (including inactive) — admin management only.
 */
export async function getAllServices(): Promise<Service[]> {
  const db = await getDb();
  return db
    .select()
    .from(services)
    .orderBy(asc(services.displayOrder), asc(services.name));
}

/**
 * Fetch single service by id.
 */
export async function getServiceById(id: number): Promise<Service | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  return row ?? null;
}

export interface CreateServiceInput {
  name: string;
  description?: string | null;
  durationMin: number;
  price: number;
  isActive?: boolean;
}

/**
 * Create new service.
 * Auto-assigns displayOrder = MAX(displayOrder) + 1 (append to end).
 */
export async function createService(
  input: CreateServiceInput,
): Promise<Service> {
  const db = await getDb();

  // Compute next displayOrder
  const [maxRow] = await db
    .select({
      max: sql<number>`COALESCE(MAX(${services.displayOrder}), -1)`.as("max"),
    })
    .from(services);
  const nextOrder = Number(maxRow?.max ?? -1) + 1;

  const values: NewService = {
    name: input.name,
    description: input.description ?? null,
    durationMin: input.durationMin,
    price: input.price,
    isActive: input.isActive ?? true,
    displayOrder: nextOrder,
  };

  const [created] = await db.insert(services).values(values).returning();
  return created;
}

export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  durationMin?: number;
  price?: number;
  isActive?: boolean;
  displayOrder?: number;
}

/**
 * Partial update — only provided fields are changed.
 * Returns null if service not found.
 */
export async function updateService(
  id: number,
  input: UpdateServiceInput,
): Promise<Service | null> {
  const db = await getDb();

  // Skip update if input empty (all fields undefined)
  const hasChanges = Object.values(input).some((v) => v !== undefined);
  if (!hasChanges) {
    return getServiceById(id);
  }

  const [updated] = await db
    .update(services)
    .set(input)
    .where(eq(services.id, id))
    .returning();

  return updated ?? null;
}

/**
 * Convenience helper for the soft-delete toggle in admin table.
 * Same as updateService with only isActive — kept separate for semantic clarity.
 */
export async function toggleServiceActive(
  id: number,
  isActive: boolean,
): Promise<Service | null> {
  return updateService(id, { isActive });
}
