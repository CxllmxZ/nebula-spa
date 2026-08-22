import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { blockedSlotCreateSchema } from "@/lib/validations";
import {
  createBlockedSlot,
  getUpcomingBlockedSlots,
} from "@/lib/db/queries/blocked-slots";
import { bangkokDateTimeToUtc, toBangkokIsoString } from "@/lib/datetime";

/**
 * GET /api/admin/blocked-slots
 * List upcoming blocked slots (endsAt >= now), sorted by startsAt asc.
 */
export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin"]);
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  try {
    const slots = await getUpcomingBlockedSlots();
    return NextResponse.json({
      slots: slots.map((s) => ({
        ...s,
        startsAt: toBangkokIsoString(s.startsAt),
        endsAt: toBangkokIsoString(s.endsAt),
        createdAt: toBangkokIsoString(s.createdAt),
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/blocked-slots] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/blocked-slots
 * Create one-off blocked slot. Admin + staff both allowed
 * (staff may need to block dates on emergency — spa reality).
 */
export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "staff"]);
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

  const parsed = blockedSlotCreateSchema.safeParse(body);
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
    const startsAt = bangkokDateTimeToUtc(
      parsed.data.date,
      parsed.data.startTime,
    );
    const endsAt = bangkokDateTimeToUtc(parsed.data.date, parsed.data.endTime);

    const created = await createBlockedSlot({
      startsAt,
      endsAt,
      reason: parsed.data.reason,
    });

    return NextResponse.json(
      {
        ...created,
        startsAt: toBangkokIsoString(created.startsAt),
        endsAt: toBangkokIsoString(created.endsAt),
        createdAt: toBangkokIsoString(created.createdAt),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/admin/blocked-slots] Unexpected error", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
