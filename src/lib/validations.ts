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
// TODO Session 6B — Admin booking management
// ============================================
// export const adminBookingFilterSchema = z.object({...});
// export const bookingStatusUpdateSchema = z.object({...});

// ============================================
// TODO Session 7+ — Service CRUD
// ============================================
// export const serviceCreateSchema = z.object({...});
// export const serviceUpdateSchema = z.object({...});

// ============================================
// TODO Session 7+ — Business hours
// ============================================
// export const businessHoursUpdateSchema = z.object({...});

// ============================================
// TODO Session 7+ — Blocked slots
// ============================================
// export const blockedSlotCreateSchema = z.object({...});
