import { customAlphabet } from "nanoid";

/**
 * 32 characters — no 0, O, 1, I, l (confusing to read/pronounce).
 * 32^6 = ~1.07 billion combinations.
 * At 100k bookings: collision probability ~0.5% (birthday paradox).
 * At realistic scale (< 10k bookings): collision extremely rare.
 */
const BOOKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BOOKING_CODE_LENGTH = 6;

const nano = customAlphabet(BOOKING_ALPHABET, BOOKING_CODE_LENGTH);

/**
 * Generate a single booking code.
 * Example: "A3F9K2", "H7M4P8"
 */
export function generateBookingCode(): string {
  return nano();
}
