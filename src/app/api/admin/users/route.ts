import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { userCreateSchema } from "@/lib/validations";
import { getAllUsers, countAdmins } from "@/lib/db/queries/users";
import { updateUserRole } from "@/lib/db/queries/users";
import { initAuth } from "@/lib/auth";

/**
 * GET /api/admin/users
 * List all users. Admin only.
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  try {
    const users = await getAllUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/users] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/users
 * Create staff account via Better Auth signUpEmail.
 * Admin only.
 *
 * Notes:
 * - autoSignIn=true in config → Better Auth creates a session for new user
 *   (orphan record — admin's browser cookie unaffected, expires per default policy)
 * - Default role from signup = "staff" (config), we PATCH after if admin role requested
 */
export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const auth = await initAuth(request);

    // Better Auth signUpEmail — creates user + account + session
    const result = await auth.api.signUpEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
      },
    });

    if (!result?.user) {
      return NextResponse.json({ error: "Signup failed" }, { status: 500 });
    }

    // If admin/manager role requested, promote after signup
    // (Better Auth default = "staff" per additionalFields config)
    let finalUser = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: "staff",
      createdAt: new Date(),
    };

    if (parsed.data.role !== "staff") {
      const updated = await updateUserRole(result.user.id, parsed.data.role);
      if (updated) {
        finalUser = {
          ...updated,
          createdAt: updated.createdAt,
        };
      }
    }

    return NextResponse.json(
      {
        ...finalUser,
        createdAt:
          finalUser.createdAt instanceof Date
            ? finalUser.createdAt.toISOString()
            : finalUser.createdAt,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/admin/users] Unexpected error", err);
    // Better Auth may throw for duplicate email → 400 semantic
    const message = err instanceof Error ? err.message : "Signup failed";
    if (message.toLowerCase().includes("already")) {
      return NextResponse.json(
        { error: "อีเมลนี้ถูกใช้แล้ว" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
