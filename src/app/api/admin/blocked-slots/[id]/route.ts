import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { deleteBlockedSlot } from "@/lib/db/queries/blocked-slots";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * DELETE /api/admin/blocked-slots/[id]
 * Remove a blocked slot. Admin + staff both allowed.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid slot id" }, { status: 400 });
  }

  try {
    const deleted = await deleteBlockedSlot(id);
    if (!deleted) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "[DELETE /api/admin/blocked-slots/[id]] Unexpected error",
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
