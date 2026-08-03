/**
 * Booking queries
 *
 * All DB access related to bookings table.
 * Business logic layer — no HTTP concerns.
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, services } from "@/lib/db/schema";
import type { Booking } from "@/lib/db/schema";
import { bangkokDateTimeToUtc } from "@/lib/datetime";
import { hasBookingConflict } from "./availability";
import { generateBookingCode } from "@/lib/nanoid";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  serviceId: number;
  date: string; // YYYY-MM-DD (Bangkok)
  time: string; // HH:MM (Bangkok)
  customerName: string;
  customerPhone: string;
  notes?: string;
}

/**
 * Result includes joined service data — needed for LINE notification
 * and confirmation page display.
 */
export interface CreateBookingResult {
  booking: Booking;
  serviceName: string;
}

/**
 * Business errors — route handler maps to HTTP status.
 */
export class BookingError extends Error {
  constructor(
    public code:
      | "SERVICE_NOT_FOUND"
      | "SLOT_CONFLICT"
      | "PAST_DATE"
      | "BEYOND_ADVANCE_LIMIT"
      | "CODE_GENERATION_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

const ADVANCE_BOOKING_DAYS = 30;
const CODE_RETRY_ATTEMPTS = 3;

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Create a new booking.
 *
 * Flow:
 *   1. Fetch service — must exist + active
 *   2. Compute starts_at/ends_at from date/time + service duration
 *   3. Validate advance booking limit (30 days)
 *   4. Check race-condition conflict
 *   5. Generate unique code (retry on collision)
 *   6. INSERT with snapshot (price + duration frozen at booking time)
 *
 * @throws BookingError on validation/conflict/collision
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const db = await getDb();

  // ─── Step 1: Fetch service ────────────────────────────────
  const [service] = await db
    .select({
      id: services.id,
      name: services.name,
      durationMin: services.durationMin,
      price: services.price,
    })
    .from(services)
    .where(and(eq(services.id, input.serviceId), eq(services.isActive, true)))
    .limit(1);

  if (!service) {
    throw new BookingError("SERVICE_NOT_FOUND", "บริการที่เลือกไม่พร้อมใช้งาน");
  }

  // ─── Step 2: Compute timestamps ───────────────────────────
  const startsAt = bangkokDateTimeToUtc(input.date, input.time);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60 * 1000);

  // ─── Step 3: Validate date range ──────────────────────────
  const now = new Date();
  if (startsAt <= now) {
    throw new BookingError("PAST_DATE", "ไม่สามารถจองในเวลาที่ผ่านมาแล้ว");
  }

  const maxAdvance = new Date(
    now.getTime() + ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000,
  );
  if (startsAt > maxAdvance) {
    throw new BookingError(
      "BEYOND_ADVANCE_LIMIT",
      `จองล่วงหน้าได้ไม่เกิน ${ADVANCE_BOOKING_DAYS} วัน`,
    );
  }

  // ─── Step 4: Race-condition guard ─────────────────────────
  if (await hasBookingConflict(startsAt, endsAt)) {
    throw new BookingError("SLOT_CONFLICT", "ช่วงเวลานี้ถูกจองไปแล้ว");
  }

  // ─── Step 5-6: Generate code + insert (retry on collision) ─
  for (let attempt = 0; attempt < CODE_RETRY_ATTEMPTS; attempt++) {
    const code = generateBookingCode();

    try {
      const [booking] = await db
        .insert(bookings)
        .values({
          code,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          serviceId: service.id,
          startsAt,
          endsAt,
          // Snapshot — booking record must survive service price changes
          durationMin: service.durationMin,
          price: service.price,
          status: "confirmed",
          notes: input.notes ?? null,
        })
        .returning();

      return { booking, serviceName: service.name };
    } catch (err) {
      // SQLite unique constraint violation → retry
      if (isUniqueViolation(err) && attempt < CODE_RETRY_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  // Should not reach — all retries exhausted
  throw new BookingError(
    "CODE_GENERATION_FAILED",
    "ไม่สามารถสร้างรหัสจองได้ กรุณาลองใหม่",
  );
}

/**
 * Fetch booking by code — for confirmation page.
 * Returns booking + service name for display.
 */
export async function getBookingByCode(
  code: string,
): Promise<(Booking & { serviceName: string }) | null> {
  const db = await getDb();

  const [result] = await db
    .select({
      // spread all booking fields
      id: bookings.id,
      code: bookings.code,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      serviceId: bookings.serviceId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      durationMin: bookings.durationMin,
      price: bookings.price,
      status: bookings.status,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
      // joined
      serviceName: services.name,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.code, code))
    .limit(1);

  if (!result) return null;

  return {
    ...result,
    serviceName: result.serviceName ?? "(บริการที่ถูกลบ)",
  };
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Detect SQLite UNIQUE constraint violation.
 * D1 error messages contain "UNIQUE constraint failed" — check message.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("UNIQUE constraint failed");
}

// ============================================
// TODO Session 6B — Admin queries
// ============================================
// TODO: getBookingsWithFilter({dateRange, status, serviceId, search}, {page, pageSize})
// TODO: getBookingStats() — today / week / month counts + revenue sum
// TODO: getRecentBookings(limit: number)
// TODO: updateBookingStatus(id: number, status: BookingStatus)
