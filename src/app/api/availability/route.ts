import { NextResponse } from "next/server";
import { z } from "zod";
import { getAvailableSlots } from "@/lib/db/queries/availability";
import { toBangkokIsoString, BANGKOK_TZ } from "@/lib/datetime";

/**
 * GET /api/availability?serviceId=1&date=2026-08-15
 *
 * Public endpoint — no auth required (customers query availability
 * during booking flow).
 *
 * Response:
 *   200 { date, serviceId, timezone, slots: [{ start, end }] }
 *   400 { error: "INVALID_INPUT", message }
 *   500 { error: "INTERNAL_ERROR" }
 */

const querySchema = z.object({
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export async function GET(request: Request) {
  try {
    // ─── Parse + validate query params ───────────────
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      serviceId: searchParams.get("serviceId"),
      date: searchParams.get("date"),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "INVALID_INPUT",
          message: firstIssue?.message ?? "Invalid query parameters",
        },
        { status: 400 },
      );
    }

    const { serviceId, date } = parsed.data;

    // ─── Compute available slots ─────────────────────
    const slots = await getAvailableSlots(serviceId, date);

    // ─── Serialize Date → ISO 8601 (Bangkok offset) ──
    return NextResponse.json({
      date,
      serviceId,
      timezone: BANGKOK_TZ,
      slots: slots.map((s) => ({
        start: toBangkokIsoString(s.start),
        end: toBangkokIsoString(s.end),
      })),
    });
  } catch (error) {
    console.error("[/api/availability] error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
