/**
 * Zod validation schemas
 *
 * All input validation lives here — form data, API request bodies,
 * Server Action inputs. Client and server reuse the same schemas.
 */

import { z } from "zod";

// ============================================
// TODO: Booking form validation
// ============================================
// export const createBookingSchema = z.object({
//   customerName: z.string().min(1, "กรอกชื่อ").max(100),
//   customerPhone: z.string().regex(/^0\d{9}$/, "เบอร์ไม่ถูกต้อง"),
//   serviceId: z.number().int().positive(),
//   startsAt: z.string().datetime(),
//   turnstileToken: z.string().min(1),
// });
// export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// ============================================
// TODO: Service CRUD validation
// ============================================
// export const createServiceSchema = z.object({...});
// export const updateServiceSchema = z.object({...});

// ============================================
// TODO: Business hours validation
// ============================================
// export const updateBusinessHoursSchema = z.object({...});

// ============================================
// TODO: Blocked slots validation
// ============================================
// export const createBlockedSlotSchema = z.object({...});

export {}; // placeholder to make this a module
