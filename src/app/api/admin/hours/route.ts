import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { businessHoursUpdateSchema } from "@/lib/validations";
import {
  getAllHours,
  getBookingsAffectedByHours,
  updateAllHours,
} from "@/lib/db/queries/business-hours";
import { toBangkokIsoString } from "@/lib/datetime";

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
 *
 * มีคิวในอนาคตที่จะหลุดนอกเวลาใหม่ + ยังไม่ confirmOverlap
 * → 409 { code: "OVERLAP", overlaps: [...] } (รูปแบบเดียวกับหน้าวันหยุด)
 * หน้าเว็บโชว์รายชื่อแล้วส่งซ้ำพร้อม confirmOverlap: true
 * คิวเดิมไม่ถูกยกเลิก — ร้านติดต่อลูกค้าเอง
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

    // อ่านแยกจาก schema → ไม่ต้องแก้ validations.ts (Zod ตัด key ที่ไม่รู้จักทิ้ง)
    const confirmOverlap =
      typeof body === "object" &&
      body !== null &&
      (body as { confirmOverlap?: unknown }).confirmOverlap === true;

    if (!confirmOverlap) {
      const overlaps = await getBookingsAffectedByHours(normalized);
      if (overlaps.length > 0) {
        return NextResponse.json(
          {
            error: `มีคิวที่จองไว้แล้ว ${overlaps.length} คิว อยู่นอกเวลาทำการใหม่`,
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
