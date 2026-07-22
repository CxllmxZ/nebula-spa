/**
 * Booking queries
 *
 * All DB access related to bookings table.
 * Includes race-condition-safe booking creation.
 */

// ============================================
// Public queries
// ============================================
// TODO: createBooking(input: NewBooking): with race condition guard
//   - Re-check availability in transaction (2 users could book same slot)
//   - Generate 6-char nanoid code
//   - Snapshot price + duration from service
// TODO: getBookingByCode(code: string) — confirmation page lookup

// ============================================
// Admin queries
// ============================================
// TODO: getBookingsWithFilter({dateRange, status, serviceId, search}, {page, pageSize})
// TODO: getBookingStats() — today / week / month counts + revenue sum
// TODO: getRecentBookings(limit: number)
// TODO: updateBookingStatus(id: number, status: BookingStatus)

export {};
