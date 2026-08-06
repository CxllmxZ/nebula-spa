import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { bookingStatusUpdateSchema } from "@/lib/validations";
import { getBookingById, updateBookingStatus } from "@/lib/db/queries/bookings";
import { toBangkokIsoString } from "@/lib/datetime";

/**
 * Next 16 dynamic route — params is Promise.
 */
type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/admin/bookings/[id]
 *
 * Fetch single booking detail.
 *
 * Response:
 *   200 { ...booking }
 *   401/403 Auth
 *   400 Invalid id
 *   404 Not found
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
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  try {
    const booking = await getBookingById(id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...booking,
      startsAt: toBangkokIsoString(booking.startsAt),
      endsAt: toBangkokIsoString(booking.endsAt),
      createdAt: toBangkokIsoString(booking.createdAt),
    });
  } catch (err) {
    console.error("[GET /api/admin/bookings/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/bookings/[id]
 *
 * Update booking status only. MVP scope — other fields not editable.
 * Workaround for time/customer changes: cancel + create new booking.
 *
 * Body: { status: "pending" | "confirmed" | "completed" | "cancelled" | "no-show" }
 *
 * Response:
 *   200 { ...updated booking }
 *   400 Validation failed
 *   401/403 Auth
 *   404 Not found
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const { id: idParam } = await params;
  const id = Number.parseInt(idParam, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bookingStatusUpdateSchema.safeParse(body);
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
    const updated = await updateBookingStatus(id, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      startsAt: toBangkokIsoString(updated.startsAt),
      endsAt: toBangkokIsoString(updated.endsAt),
      createdAt: toBangkokIsoString(updated.createdAt),
    });
  } catch (err) {
    console.error("[PATCH /api/admin/bookings/[id]] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
