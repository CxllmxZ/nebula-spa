import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { serviceCreateSchema } from "@/lib/validations";
import { createService, getAllServices } from "@/lib/db/queries/services";

/**
 * GET /api/admin/services
 * List all services (including inactive) for admin management.
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  try {
    const services = await getAllServices();
    return NextResponse.json({ services });
  } catch (err) {
    console.error("[GET /api/admin/services] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/services
 * Create new service (admin only — staff read-only for settings).
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

  const parsed = serviceCreateSchema.safeParse(body);
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
    const created = await createService(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/services] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
