import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

// ============================================
// Database client factory
// ============================================
//
// This will be replaced with real Cloudflare D1 binding once
// @opennextjs/cloudflare is set up (next chat).
//
// Final pattern (after Cloudflare setup):
//   import { getCloudflareContext } from "@opennextjs/cloudflare";
//   export function getDb() {
//     const { env } = getCloudflareContext();
//     return drizzle(env.DB, { schema });
//   }
//
// For now, throw at import-time so no one tries to call it.

export type DB = DrizzleD1Database<typeof schema>;

export function getDb(): DB {
  throw new Error(
    "Database not configured yet. Setup @opennextjs/cloudflare in next chat.",
  );
}

// Re-export schema for convenience
export * from "./schema";
