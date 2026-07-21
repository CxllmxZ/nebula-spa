"use server";

// TODO: implement with Zod validation + Drizzle + LINE notify
// Public actions:
//   - createBooking(input): create new booking with race condition guard
// Admin actions (require auth):
//   - updateBookingStatus(id, status): change status
//   - cancelBooking(id): cancel booking

export async function createBooking() {
  throw new Error("Not implemented");
}

export async function updateBookingStatus() {
  throw new Error("Not implemented");
}
