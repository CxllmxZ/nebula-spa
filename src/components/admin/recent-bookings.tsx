"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

import { BANGKOK_TZ } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_CONFIG } from "@/lib/booking-status";
import type { AdminBookingListItem } from "@/lib/db/queries/bookings";
import { BookingDetailDialog } from "./booking-detail-dialog";

interface RecentBookingsProps {
  bookings: AdminBookingListItem[];
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
  const [selected, setSelected] = useState<AdminBookingListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openBooking(b: AdminBookingListItem) {
    setSelected(b);
    setDialogOpen(true);
  }

  if (bookings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        ยังไม่มีการจอง
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {bookings.map((b) => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => openBooking(b)}
              className="w-full flex items-center gap-4 py-3 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors text-left"
            >
              <div className="min-w-[64px] text-center">
                <div className="text-xs text-muted-foreground">
                  {formatInTimeZone(b.startsAt, BANGKOK_TZ, "d MMM")}
                </div>
                <div className="text-sm font-semibold">
                  {formatInTimeZone(b.startsAt, BANGKOK_TZ, "HH:mm")}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{b.customerName}</div>
                <div className="truncate text-sm text-muted-foreground">
                  {b.serviceName}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="text-sm font-semibold">
                  {formatCurrency(b.price)}
                </div>
                <Badge
                  variant={BOOKING_STATUS_CONFIG[b.status].variant}
                  className="text-xs"
                >
                  {BOOKING_STATUS_CONFIG[b.status].label}
                </Badge>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <BookingDetailDialog
        booking={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
