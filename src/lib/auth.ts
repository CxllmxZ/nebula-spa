import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type {
  D1Database,
  IncomingRequestCfProperties,
} from "@cloudflare/workers-types";
import * as schema from "./db/schema";

/**
 * Create Better Auth instance.
 *
 * Dual-mode:
 *   - CLI (schema generation): env=undefined, uses empty adapter
 *   - Runtime (API request):   env passed, real Drizzle + D1
 */
function createAuth(
  env?: CloudflareEnv,
  cf?: IncomingRequestCfProperties,
  baseURL?: string,
) {
  const db = env ? drizzle(env.nebula_spa_db, { schema }) : ({} as any);

  return betterAuth({
    baseURL,
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: false, // spa demo — ไม่ต้อง geo
        cf: cf || {},
        d1: env
          ? {
              db,
              options: {
                usePlural: true, // tables: users, sessions (ไม่ใช่ user, session)
                debugLogs: false,
              },
            }
          : undefined,
      },
      {
        emailAndPassword: {
          enabled: true,
          autoSignIn: true, // login auto หลัง signup
        },
        // Custom field: role for RBAC (Option B — admin | staff)
        user: {
          additionalFields: {
            role: {
              type: "string",
              required: true,
              defaultValue: "staff", // default = ปลอดภัย (สิทธิ์น้อยสุด)
            },
          },
        },
        // Rate limit — ป้องกัน brute force login
        rateLimit: {
          enabled: true,
          window: 60,
          max: 100,
          customRules: {
            "/sign-in/email": { window: 60, max: 10 }, // login เข้มกว่า
          },
        },
      },
    ),
    // CLI fallback — ต้องมี database เพื่อ generate schema
    ...(env
      ? {}
      : {
          database: drizzleAdapter({} as D1Database, {
            provider: "sqlite",
            usePlural: true,
          }),
        }),
  });
}

/**
 * Export for CLI schema generation.
 * Better Auth CLI reads this to know what schema to generate.
 */
export const auth = createAuth();

/**
 * Initialize auth at request time (runtime).
 * Used by /api/auth/[...all] route handler.
 */
export async function initAuth(request?: Request) {
  const { env, cf } = await getCloudflareContext({ async: true });
  const baseURL = request ? new URL(request.url).origin : undefined;
  return createAuth(
    env as CloudflareEnv,
    cf as IncomingRequestCfProperties | undefined,
    baseURL,
  );
}
