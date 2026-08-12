/**
 * User management queries (admin panel).
 *
 * Note: Better Auth owns users table — we read/update role field only.
 * Creation via Better Auth API (auth.api.signUpEmail) in route handler.
 * Deletion via direct Drizzle — cascade to sessions/accounts via FK.
 */

import { asc, eq, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { AllowedRole } from "@/lib/auth-guard";

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: string; // "admin" | "staff" | "manager"
  createdAt: Date;
}

/**
 * List all users for admin management.
 * Sort by createdAt DESC — newest first (typical audit view).
 */
export async function getAllUsers(): Promise<UserListItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  return rows;
}

export async function getUserById(id: string): Promise<UserListItem | null> {
  const db = await getDb();
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Count users with admin role — for "last admin" guard.
 */
export async function countAdmins(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(eq(users.role, "admin"));
  return Number(row?.n ?? 0);
}

/**
 * Update user role — direct DB write.
 * Better Auth reads role from user table on every session fetch,
 * so change takes effect on next request (no session invalidation needed).
 */
export async function updateUserRole(
  id: string,
  role: AllowedRole,
): Promise<UserListItem | null> {
  const db = await getDb();
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    });
  return updated ?? null;
}

/**
 * Delete user — sessions + accounts cascade via FK.
 * Returns true if deleted.
 */
export async function deleteUserById(id: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .delete(users)
    .where(eq(users.id, id))
    .returning({ id: users.id });
  return result.length > 0;
}
