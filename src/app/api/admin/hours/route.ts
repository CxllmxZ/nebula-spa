import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { businessHoursUpdateSchema } from "@/lib/validations";
import { getAllHours, updateAllHours } from "@/lib/db/queries/business-hours";

/**
 * GET /api/admin/hours
 * Returns all 7 rows (auto-fills missing days as closed).
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  try {
    const hours = await getAllHours();
    return NextResponse.json({ hours });
  } catch (err) {
    console.error("[GET /api/admin/hours] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/hours
 * Replace all 7 rows atomically (batch delete + insert).
 * Admin only.
 */
export async function PUT(request: Request) {
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

  const parsed = businessHoursUpdateSchema.safeParse(body);
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
    // Normalize: if isClosed, null out times
    const normalized = parsed.data.hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.isClosed ? null : (h.openTime ?? null),
      closeTime: h.isClosed ? null : (h.closeTime ?? null),
      isClosed: h.isClosed,
    }));

    const updated = await updateAllHours(normalized);
    return NextResponse.json({ hours: updated });
  } catch (err) {
    console.error("[PUT /api/admin/hours] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
