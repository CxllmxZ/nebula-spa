import { NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * Get Drizzle DB instance for the current request.
 *
 * Must be called within a Cloudflare Workers request context
 * (Server Component, Server Action, Route Handler, or Middleware).
 *
 * Uses async initialization pattern from @opennextjs/cloudflare
 * — cannot import DB at module top-level.
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.nebula_spa_db, { schema });
}

export type DB = Awaited<ReturnType<typeof getDb>>;
