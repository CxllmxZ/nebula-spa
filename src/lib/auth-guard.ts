import { headers } from "next/headers";
import { initAuth } from "./auth";

export type AllowedRole = "admin" | "staff" | "manager";

/**
 * For Server Actions.
 * Throws Error — Server Action boundary catches.
 */
class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * For Route Handlers.
 * Throws Response 401/403 — Next.js catches and returns to client.
 *
 * Usage:
 *   export async function GET(request: Request) {
 *     try {
 *       const session = await requireRole(request, ['admin', 'staff']);
 *       // ... query
 *     } catch (err) {
 *       if (err instanceof Response) return err;
 *       throw err;
 *     }
 *   }
 */
export async function requireRole(request: Request, allowed: AllowedRole[]) {
  const auth = await initAuth(request);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !allowed.includes(role as AllowedRole)) {
    throw new Response(
      JSON.stringify({
        error: "มีแค่เจ้าของร้านที่เปลี่ยนได้",
        requiredRole: allowed,
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return session;
}

/**
 * For Server Actions.
 * Uses next/headers instead of request object.
 *
 * Usage:
 *   'use server';
 *   export async function updateService(data: FormData) {
 *     await requireRoleAction(['admin']);
 *     // ... mutation
 *   }
 */
export async function requireRoleAction(allowed: AllowedRole[]) {
  const hdrs = await headers();
  const auth = await initAuth();
  const session = await auth.api.getSession({ headers: hdrs });

  if (!session) {
    throw new AuthError(401, "Unauthorized");
  }

  const role = (session.user as { role?: string }).role;
  if (!role || !allowed.includes(role as AllowedRole)) {
    throw new AuthError(403, "Forbidden");
  }

  return session;
}

export { AuthError };

/**
 * Extract current user id from session — used by admin guards
 * (prevent self-delete, self-demote).
 */
export function getSessionUserId(session: { user: { id: string } }): string {
  return session.user.id;
}
