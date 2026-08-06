import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { adminBookingFilterSchema } from "@/lib/validations";
import { getBookingsWithFilter } from "@/lib/db/queries/bookings";
import { toBangkokIsoString } from "@/lib/datetime";

/**
 * GET /api/admin/bookings
 *
 * Admin/staff-protected — list bookings with filter + pagination.
 *
 * Query params (all optional):
 *   - dateFrom=YYYY-MM-DD
 *   - dateTo=YYYY-MM-DD
 *   - status=confirmed | status=confirmed,pending (comma-separated)
 *   - serviceId=1
 *   - search=<name/phone/code substring>
 *   - page=1
 *   - pageSize=20 (max 100)
 *
 * Response:
 *   200 { bookings: [...], meta: { total, page, pageSize, totalPages } }
 *   400 Validation failed
 *   401 Unauthorized
 *   403 Forbidden
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin", "staff"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  // Parse query params → object for Zod
  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const parsed = adminBookingFilterSchema.safeParse(params);
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
    const result = await getBookingsWithFilter(parsed.data);

    // Serialize Date → ISO 8601 Bangkok at route boundary
    return NextResponse.json({
      bookings: result.bookings.map((b) => ({
        ...b,
        startsAt: toBangkokIsoString(b.startsAt),
        endsAt: toBangkokIsoString(b.endsAt),
        createdAt: toBangkokIsoString(b.createdAt),
      })),
      meta: result.meta,
    });
  } catch (err) {
    console.error("[GET /api/admin/bookings] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
