/**
 * Booking queries
 *
 * All DB access related to bookings table.
 * Business logic layer — no HTTP concerns.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, services } from "@/lib/db/schema";
import type { Booking } from "@/lib/db/schema";
import {
  bangkokDateTimeToUtc,
  getBangkokDayRange,
  getBangkokWeekRange,
  getBangkokMonthRange,
  BANGKOK_TZ,
} from "@/lib/datetime";
import { hasBookingConflict } from "./availability";
import { generateBookingCode } from "@/lib/nanoid";
import type { AdminBookingFilter } from "@/lib/validations";
import { start } from "repl";
import { number } from "zod";
import { formatInTimeZone } from "date-fns-tz";

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

// ─────────────────────────────────────────────────────────────
// Admin queries
// ─────────────────────────────────────────────────────────────

const BOOKING_STATUS_VALUES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
] as const;

export type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

export interface AdminBookingListItem {
  id: number;
  code: string;
  customerName: string;
  customerPhone: string;
  serviceId: number;
  serviceName: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  price: number;
  status: BookingStatus;
  notes: string | null;
  createdAt: Date;
}

export interface AdminBookingListResult {
  bookings: AdminBookingListItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/**
 * List bookings with filter + pagination.
 * All filters combinable — empty filter returns all bookings.
 *
 * Search: matches customerName / customerPhone / code (case-insensitive LIKE).
 * Date range: inclusive (dateFrom 00:00 → dateTo 23:59:59, Bangkok).
 */
export async function getBookingsWithFilter(
  filter: AdminBookingFilter,
): Promise<AdminBookingListResult> {
  const db = await getDb();

  // ─── Build WHERE conditions ───────────────────────────────
  const conditions = [];

  // Date range → convert Bangkok string to UTC boundaries
  if (filter.dateFrom) {
    const from = bangkokDateTimeToUtc(filter.dateFrom, "00:00");
    conditions.push(gte(bookings.startsAt, from));
  }
  if (filter.dateTo) {
    const to = bangkokDateTimeToUtc(filter.dateTo, "23:59");
    conditions.push(lte(bookings.startsAt, to));
  }

  // Status multi-select
  if (filter.status && filter.status.length > 0) {
    conditions.push(inArray(bookings.status, filter.status));
  }

  // Service filter
  if (filter.serviceId) {
    conditions.push(eq(bookings.serviceId, filter.serviceId));
  }

  // Search: name OR phone OR code (case-insensitive)
  if (filter.search) {
    const pattern = `%${filter.search}%`;
    conditions.push(
      or(
        like(bookings.customerName, pattern),
        like(bookings.customerPhone, pattern),
        like(bookings.code, pattern),
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // ─── Count total (for pagination meta) ────────────────────
  const [countRow] = await db
    .select({ total: count() })
    .from(bookings)
    .where(whereClause);

  const total = countRow?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));

  // ─── Query paginated data + join service name ─────────────
  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      serviceId: bookings.serviceId,
      serviceName: services.name,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      durationMin: bookings.durationMin,
      price: bookings.price,
      status: bookings.status,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(whereClause)
    .orderBy(asc(bookings.startsAt))
    .limit(filter.pageSize)
    .offset((filter.page - 1) * filter.pageSize);

  const items: AdminBookingListItem[] = rows.map((r) => ({
    ...r,
    serviceName: r.serviceName ?? "(บริการที่ถูกลบ)",
    status: r.status as BookingStatus,
  }));

  return {
    bookings: items,
    meta: {
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages,
    },
  };
}

/**
 * Fetch single booking by numeric id — for admin detail view.
 * Returns null if not found.
 */
export async function getBookingById(
  id: number,
): Promise<AdminBookingListItem | null> {
  const db = await getDb();

  const [row] = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      serviceId: bookings.serviceId,
      serviceName: services.name,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      durationMin: bookings.durationMin,
      price: bookings.price,
      status: bookings.status,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .where(eq(bookings.id, id))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    serviceName: row.serviceName ?? "(บริการที่ถูกลบ)",
    status: row.status as BookingStatus,
  };
}

/**
 * Update booking status.
 * MVP: free change — no state machine enforcement.
 *
 * @returns updated booking or null if not found
 */
export async function updateBookingStatus(
  id: number,
  status: BookingStatus,
): Promise<AdminBookingListItem | null> {
  const db = await getDb();

  const [updated] = await db
    .update(bookings)
    .set({ status })
    .where(eq(bookings.id, id))
    .returning();

  if (!updated) return null;

  // Re-fetch with joined service name for consistent return shape
  return getBookingById(id);
}

// ─────────────────────────────────────────────────────────────
// Dashboard stats
// ─────────────────────────────────────────────────────────────

/**
 * Statuses ที่นับเป็น "รายได้คาดการณ์" — exclude cancelled + no-show.
 * confirmed = จองแล้ว, completed = รับบริการเสร็จ
 * label ใน UI: "รายได้คาดการณ์" (ไม่ใช่ "รายได้จริง")
 */
const REVENUE_STATUSES: BookingStatus[] = ["confirmed", "completed"];

export interface BookingStats {
  today: {
    count: number;
    revenue: number;
    upcommingCount: number; // confirmed + startsAt > now (in today range)
  };
  week: { count: number; revenue: number };
  month: { count: number; revenue: number };
}

/**
 * Aggregate booking stats for admin dashboard.
 *
 * - count/revenue: bookings with status IN (confirmed, completed) within [start, end)
 * - upcomingCount: today's confirmed bookings with startsAt still in the future
 *
 * Ranges align to Bangkok calendar (day/week/month).
 * Week = Monday-Sunday (ISO 8601).
 *
 * All queries run in parallel via Promise.all.
 */
export async function getBookingStats(): Promise<BookingStats> {
  const db = await getDb();
  const now = new Date();

  const todayRange = getBangkokDayRange(now);
  const weekRange = getBangkokWeekRange(now);
  const monthRange = getBangkokMonthRange(now);

  // Closure over db — reused in 4 parallel queries
  const aggregateInRange = (start: Date, end: Date) =>
    db
      .select({
        count: sql<number>`COUNT(*)`.as("count"),
        revenue: sql<number>`COALESCE(SUM(${bookings.price}), 0)`.as("revenue"),
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.status, REVENUE_STATUSES),
          gte(bookings.startsAt, start),
          lt(bookings.startsAt, end),
        ),
      )
      .then((rows) => ({
        count: Number(rows[0]?.count ?? 0),
        revenue: Number(rows[0]?.revenue ?? 0),
      }));

  const [todayAgg, weekAgg, monthAgg, upcomingRows] = await Promise.all([
    aggregateInRange(todayRange.start, todayRange.end),
    aggregateInRange(weekRange.start, weekRange.end),
    aggregateInRange(monthRange.start, weekRange.end),
    db
      .select({ count: sql<number>`COUNT(*)`.as("count") })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          gte(bookings.startsAt, now),
          lt(bookings.startsAt, todayRange.end),
        ),
      ),
  ]);

  return {
    today: {
      count: todayAgg.count,
      revenue: todayAgg.revenue,
      upcommingCount: Number(upcomingRows[0]?.count ?? 0),
    },
    week: weekAgg,
    month: monthAgg,
  };
}

/**
 * Fetch N most-recently-created bookings — for dashboard "recent activity" widget.
 * Sort by createdAt DESC (newest first).
 *
 * Note: sort key = createdAt (จองล่าสุด) ไม่ใช่ startsAt (บริการล่าสุด/ถัดไป).
 * ถ้าอยาก "upcoming" ใช้ getBookingsWithFilter สั่ง sort startsAt asc + status filter
 */
export async function getRecentBookings(
  limit: number = 5,
): Promise<AdminBookingListItem[]> {
  const db = await getDb();

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      serviceId: bookings.serviceId,
      serviceName: services.name,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      durationMin: bookings.durationMin,
      price: bookings.price,
      status: bookings.status,
      notes: bookings.notes,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .leftJoin(services, eq(bookings.serviceId, services.id))
    .orderBy(desc(bookings.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    serviceName: r.serviceName ?? "(บริการที่ถูกลบ)",
    status: r.status as BookingStatus,
  }));
}

// ─────────────────────────────────────────────────────────────
// Calendar helpers
// ─────────────────────────────────────────────────────────────

/**
 * Return set of Bangkok date strings (YYYY-MM-DD) ที่มี booking ในเดือนที่ระบุ.
 * ใช้กับ Calendar dots — react-day-picker modifiers รับ Date[] แต่ Set<string>
 * comparison เร็วกว่า + serialize ง่ายกว่าถ้าส่ง client
 *
 * @param year - 4-digit year, Bangkok calendar
 * @param month - 1-12 (JS convention: Date.getMonth() = 0-11, ตรงนี้ 1-indexed)
 * @returns Set<"YYYY-MM-DD"> — dates ที่มี booking status = confirmed/completed
 */
export async function getBookedDatesInMonth(
  year: number,
  month: number, //1-12
): Promise<Set<string>> {
  const db = await getDb();

  // Bangkok month range [1st 00:00, 1st next 00:00)
  // ใช้ getBangkokMonthRange แต่ต้อง feed date ที่อยู่ในเดือนที่ต้องการ
  // Construct via Bangkok "YYYY-MM-01" → UTC ก่อนใช้เป็น anchor
  const anchor = bangkokDateTimeToUtc(
    `${year}-${String(month).padStart(2, "0")}-01`,
    "00:00",
  );
  const range = getBangkokMonthRange(anchor);

  const rows = await db
    .select({
      startsAt: bookings.startsAt,
    })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, REVENUE_STATUSES),
        gte(bookings.startsAt, range.start),
        lt(bookings.startsAt, range.end),
      ),
    );

  // Convert each UTC Date → Bangkok "YYYY-MM-DD"
  const dates = new Set<string>();
  for (const row of rows) {
    dates.add(formatInTimeZone(row.startsAt, BANGKOK_TZ, "yyyy-MM-dd"));
  }
  return dates;
}
