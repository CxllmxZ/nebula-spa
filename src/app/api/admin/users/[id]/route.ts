import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { userRoleUpdateSchema } from "@/lib/validations";
import {
  countAdmins,
  deleteUserById,
  getUserById,
  updateUserRole,
} from "@/lib/db/queries/users";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/admin/users/[id]
 * Change user role. Admin only.
 *
 * Guards:
 * - Cannot change own role (block self-demote)
 * - Cannot demote last admin
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  let session;
  try {
    session = await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  // Guard: cannot change own role
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "ไม่สามารถเปลี่ยน role ของตัวเองได้" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = userRoleUpdateSchema.safeParse(body);
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
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Guard: cannot demote last admin
    if (target.role === "admin" && parsed.data.role !== "admin") {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "ต้องมี admin อย่างน้อย 1 คน" },
          { status: 400 },
        );
      }
    }

    const updated = await updateUserRole(id, parsed.data.role);
    if (!updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user + cascade sessions/accounts. Admin only.
 *
 * Guards:
 * - Cannot delete self
 * - Cannot delete last admin
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  let session;
  try {
    session = await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  // Guard: cannot delete self
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "ไม่สามารถลบตัวเองได้" },
      { status: 403 },
    );
  }

  try {
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Guard: cannot delete last admin
    if (target.role === "admin") {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "ต้องมี admin อย่างน้อย 1 คน" },
          { status: 400 },
        );
      }
    }

    const deleted = await deleteUserById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/users/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
