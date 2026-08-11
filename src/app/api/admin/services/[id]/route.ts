import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { serviceUpdateSchema } from "@/lib/validations";
import { getServiceById, updateService } from "@/lib/db/queries/services";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/services/[id]
 * Fetch single service (for future edit dialog pre-fill via URL share).
 * MVP: not directly used by UI (edit dialog receives full object from list).
 */
export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid service id" }, { status: 400 });
  }

  try {
    const service = await getServiceById(id);
    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json(service);
  } catch (err) {
    console.error("[GET /api/admin/services/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/services/[id]
 * Partial update. Admin only.
 * Also handles isActive toggle (soft delete via UI switch).
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid service id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = serviceUpdateSchema.safeParse(body);
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

  // Require at least 1 field to update
  const hasAny = Object.values(parsed.data).some((v) => v !== undefined);
  if (!hasAny) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await updateService(id, parsed.data);
    if (!updated) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/admin/services/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
