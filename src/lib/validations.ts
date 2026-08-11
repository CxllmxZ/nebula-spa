/**
 * Zod validation schemas
 *
 * All input validation lives here — form data, API request bodies,
 * Server Action inputs. Client and server reuse the same schemas.
 */

import { z } from "zod";

// ============================================
// Booking — Public create
// ============================================

/**
 * POST /api/bookings — customer creates booking.
 *
 * Note: date + time split (not ISO string) to match:
 *   - Availability API pattern (?date=YYYY-MM-DD)
 *   - Form field structure (calendar picker + time slot picker)
 */
export const bookingCreateSchema = z.object({
  serviceId: z.number().int().positive(),

  // YYYY-MM-DD (Bangkok local date)
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)"),

  // HH:MM 24-hour (Bangkok local time)
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)"),

  customerName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(100, "ชื่อยาวเกินไป"),

  // Thai mobile: 10 digits starting with 0
  customerPhone: z
    .string()
    .regex(/^0\d{9}$/, "เบอร์โทรไม่ถูกต้อง (10 หลัก เริ่มด้วย 0)"),

  turnstileToken: z.string().min(1, "Turnstile token required"),

  notes: z.string().max(500).optional(),
});

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

// ============================================
// Booking — Admin filter & status update
// ============================================
const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
] as const;

/**
 * GET /api/admin/bookings — list with filter.
 *
 * All filters optional + combinable.
 * Query params coerce: strings from URL → number/date where needed.
 */
export const adminBookingFilterSchema = z.object({
  // Date range (Bangkok calendar date)
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง")
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง")
    .optional(),

  // Multi-status: "confirmed" or "confirmed,pending"
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()) : undefined))
    .pipe(z.array(z.enum(BOOKING_STATUSES)).optional()),

  serviceId: z.coerce.number().int().positive().optional(),

  // Search: matches name / phone / code
  search: z.string().trim().min(1).max(100).optional(),

  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminBookingFilter = z.infer<typeof adminBookingFilterSchema>;

/**
 * PATCH /api/admin/bookings/[id] — status change only.
 * MVP: no other fields editable (workaround: cancel + create new).
 */
export const bookingStatusUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
});

export type BookingStatusUpdate = z.infer<typeof bookingStatusUpdateSchema>;

// ============================================
// Service CRUD (admin)
// ============================================

/**
 * POST /api/admin/services — create new service.
 */
export const serviceCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อบริการ")
    .max(100, "ชื่อยาวเกินไป"),
  description: z
    .string()
    .trim()
    .max(500, "คำอธิบายยาวเกินไป")
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null)),
  durationMin: z
    .number()
    .int("ระยะเวลาต้องเป็นจำนวนเต็ม")
    .min(15, "ระยะเวลาอย่างน้อย 15 นาที")
    .max(240, "ระยะเวลาไม่เกิน 240 นาที"),
  price: z.number().int("ราคาต้องเป็นจำนวนเต็ม").min(1, "ราคาต้องมากกว่า 0"),
  isActive: z.boolean().default(true),
});

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

/**
 * PATCH /api/admin/services/[id] — partial update.
 * All fields optional; providing at least one required (enforced in route).
 */
export const serviceUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อบริการ")
    .max(100, "ชื่อยาวเกินไป")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "คำอธิบายยาวเกินไป")
    .nullish() // ← เปลี่ยนจาก .optional() เป็น .nullish() (undefined | null | string)
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      return v.length > 0 ? v : null;
    }),
  durationMin: z
    .number()
    .int()
    .min(15, "ระยะเวลาอย่างน้อย 15 นาที")
    .max(240, "ระยะเวลาไม่เกิน 240 นาที")
    .optional(),
  price: z.number().int().min(1, "ราคาต้องมากกว่า 0").optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

// ============================================
// Business hours (admin)
// ============================================

/**
 * PUT /api/admin/hours — replace all 7 rows.
 *
 * Client sends 7 rows array covering dayOfWeek 0-6.
 * If isClosed=true, openTime/closeTime can be null or ignored.
 * If isClosed=false, both times required + openTime < closeTime.
 */
export const businessHourRowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)")
      .nullish(),
    closeTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)")
      .nullish(),
    isClosed: z.boolean(),
  })
  .refine((r) => r.isClosed || (r.openTime && r.closeTime), {
    message: "กรุณาระบุเวลาเปิดและปิด (หรือติ๊กว่า 'ปิด')",
  })
  .refine(
    (r) =>
      r.isClosed || !r.openTime || !r.closeTime || r.openTime < r.closeTime,
    { message: "เวลาเปิดต้องก่อนเวลาปิด" },
  );

export const businessHoursUpdateSchema = z
  .object({
    hours: z.array(businessHourRowSchema).length(7, "ต้องส่งครบ 7 วัน"),
  })
  .refine(
    (data) => {
      const days = new Set(data.hours.map((h) => h.dayOfWeek));
      return days.size === 7;
    },
    { message: "dayOfWeek ต้องครบ 0-6 ไม่ซ้ำ" },
  );

export type BusinessHoursUpdateInput = z.infer<
  typeof businessHoursUpdateSchema
>;

// ============================================
// Blocked slots (admin)
// ============================================

/**
 * POST /api/admin/blocked-slots — create one-off block.
 *
 * Client sends Bangkok date + start/end times.
 * Backend converts to UTC via bangkokDateTimeToUtc before insert.
 */
export const blockedSlotCreateSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)"),
    startTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)"),
    endTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง (HH:MM)"),
    reason: z
      .string()
      .trim()
      .max(200, "เหตุผลยาวเกินไป")
      .nullish()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "เวลาเริ่มต้องก่อนเวลาสิ้นสุด",
    path: ["endTime"],
  })
  .refine(
    (d) => {
      // Reject past dates (past = strictly before today Bangkok calendar)
      const todayBkk = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Bangkok",
      });
      return d.date >= todayBkk;
    },
    {
      message: "ไม่สามารถเพิ่มวันหยุดในอดีตได้",
      path: ["date"],
    },
  );

export type BlockedSlotCreateInput = z.infer<typeof blockedSlotCreateSchema>;
