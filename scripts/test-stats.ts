import { getBookingStats } from "@/lib/db/queries/bookings";
import { stat } from "fs";

export async function GET() {
  const stats = await getBookingStats();
  return Response.json(stats);
}
