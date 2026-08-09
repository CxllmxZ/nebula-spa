import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import { BANGKOK_TZ } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import type { AdminBookingListItem } from "@/lib/db/queries/bookings";

interface RecentBookingsProps {
  bookings: AdminBookingListItem[];
}

export function RecentBookings({ bookings }: RecentBookingsProps) {
  if (bookings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        ยังไม่มีการจอง
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link
            href={`/admin/bookings/${b.id}`}
            className="flex items-center gap-4 py-3 hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
          >
            {/* Left — datetime block */}
            <div className="min-w-[64px] text-center">
              <div className="text-xs text-muted-foreground">
                {formatInTimeZone(b.startsAt, BANGKOK_TZ, "d MMM")}
              </div>
              <div className="text-sm font-semibold">
                {formatInTimeZone(b.startsAt, BANGKOK_TZ, "HH:mm")}
              </div>
            </div>

            {/* Middle — customer + service */}
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{b.customerName}</div>
              <div className="truncate text-sm text-muted-foreground">
                {b.serviceName}
              </div>
            </div>

            {/* Right — price + status */}
            <div className="flex flex-col items-end gap-1">
              <div className="text-sm font-semibold">
                {formatCurrency(b.price)}
              </div>
              <StatusBadge status={b.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const STATUS_CONFIG: Record<
  AdminBookingListItem["status"],
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  pending: { label: "รอยืนยัน", variant: "secondary" },
  confirmed: { label: "ยืนยันแล้ว", variant: "default" },
  completed: { label: "เสร็จสิ้น", variant: "outline" },
  cancelled: { label: "ยกเลิก", variant: "destructive" },
  "no-show": { label: "ไม่มา", variant: "destructive" },
};

function StatusBadge({ status }: { status: AdminBookingListItem["status"] }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}
