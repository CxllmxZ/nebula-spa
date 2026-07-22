/**
 * Availability calculation
 *
 * Given a service and date, computes available time slots by:
 *   1. Getting business hours for that day of week
 *   2. Fetching existing bookings on that date (pending/confirmed)
 *   3. Fetching blocked slots on that date
 *   4. Generating 30-min grid across business hours
 *   5. Filtering slots that:
 *      - Fit within business hours (end <= close_time)
 *      - Don't overlap existing bookings
 *      - Don't overlap blocked slots
 *      - Are in the future (if today)
 */

// ============================================
// TODO: Public availability query
// ============================================
// export async function getAvailableSlots(
//   serviceId: number,
//   date: string  // 'YYYY-MM-DD' in Asia/Bangkok
// ): Promise<string[]>  // array of 'HH:MM' strings

// ============================================
// TODO: Internal helpers
// ============================================
// function generateSlotGrid(open: string, close: string, intervalMin: number): string[]
// function hasOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean

export {};
