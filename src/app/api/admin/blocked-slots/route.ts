import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { blockedSlotCreateSchema } from "@/lib/validations";
import {
  createBlockedSlot,
  getOverlappingBookings,
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
 *
 * allDay → 00:00 ถึง 00:00 วันถัดไป (ครอบทุกเวลาเปิด → นับเป็นวันร้านปิด)
 *
 * มีคิวทับช่วงนี้ + ยังไม่ confirmOverlap → 409 { code: "OVERLAP", overlaps: [...] }
 * ให้หน้าเว็บโชว์รายชื่อแล้วส่งซ้ำพร้อม confirmOverlap: true
 * คิวเดิมไม่ถูกยกเลิก — ร้านติดต่อลูกค้าเอง
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
    const { date, allDay } = parsed.data;
    const startsAt = allDay
      ? bangkokDateTimeToUtc(date, "00:00")
      : bangkokDateTimeToUtc(date, parsed.data.startTime!);
    const endsAt = allDay
      ? bangkokDateTimeToUtc(addDays(date, 1), "00:00")
      : bangkokDateTimeToUtc(date, parsed.data.endTime!);

    if (!parsed.data.confirmOverlap) {
      const overlaps = await getOverlappingBookings(startsAt, endsAt);
      if (overlaps.length > 0) {
        return NextResponse.json(
          {
            error: `ช่วงนี้มีคิวที่จองไว้แล้ว ${overlaps.length} คิว`,
            code: "OVERLAP",
            overlaps: overlaps.map((b) => ({
              ...b,
              startsAt: toBangkokIsoString(b.startsAt),
            })),
          },
          { status: 409 },
        );
      }
    }

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

/** "YYYY-MM-DD" + n วัน (วันปฏิทิน ไม่มี timezone) */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
