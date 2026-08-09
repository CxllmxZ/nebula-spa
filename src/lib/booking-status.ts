import type { BookingStatus } from "@/lib/db/queries/bookings";

/**
 * Shared status label + variant config.
 * Used in: recent bookings widget (7C), bookings table (7D), detail views.
 *
 * Design rationale:
 * - cancelled = outline (fade — lifecycle end, no action needed)
 * - no-show = destructive (highlight — problem, may need action)
 * - See 7C.5 discussion for full rationale
 */
export const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  pending: { label: "รอยืนยัน", variant: "secondary" },
  confirmed: { label: "ยืนยันแล้ว", variant: "default" },
  completed: { label: "เสร็จสิ้น", variant: "outline" },
  cancelled: { label: "ยกเลิก", variant: "outline" },
  "no-show": { label: "ไม่มา", variant: "destructive" },
};

/**
 * Ordered list for dropdowns/selects.
 * Order = typical booking lifecycle for readability.
 */
export const BOOKING_STATUS_LIST: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
];
