"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { BANGKOK_TZ } from "@/lib/datetime";
import { formatCurrency } from "@/lib/format";
import { BOOKING_STATUS_CONFIG } from "@/lib/booking-status";
import type { AdminBookingListItem } from "@/lib/db/queries/bookings";
import type { AdminBookingFilter } from "@/lib/validations";
import { BookingDetailDialog } from "./booking-detail-dialog";

interface Props {
  bookings: AdminBookingListItem[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  currentFilter: AdminBookingFilter;
}

export function BookingsTable({ bookings, meta, currentFilter }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AdminBookingListItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openBooking(b: AdminBookingListItem) {
    setSelected(b);
    setDialogOpen(true);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (currentFilter.dateFrom) params.set("dateFrom", currentFilter.dateFrom);
    if (currentFilter.dateTo) params.set("dateTo", currentFilter.dateTo);
    if (currentFilter.status && currentFilter.status.length > 0) {
      params.set("status", currentFilter.status.join(","));
    }
    if (currentFilter.serviceId) {
      params.set("serviceId", String(currentFilter.serviceId));
    }
    if (currentFilter.search) params.set("search", currentFilter.search);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        ไม่พบการจองที่ตรงกับตัวกรอง
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>เวลา</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>บริการ</TableHead>
                <TableHead className="text-right">ราคา</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => {
                const cfg = BOOKING_STATUS_CONFIG[b.status];
                return (
                  <TableRow
                    key={b.id}
                    onClick={() => openBooking(b)}
                    className="cursor-pointer"
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatInTimeZone(b.startsAt, BANGKOK_TZ, "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm font-medium">
                      {formatInTimeZone(b.startsAt, BANGKOK_TZ, "HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.customerPhone}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.serviceName}
                      <div className="text-xs text-muted-foreground">
                        {b.durationMin} นาที
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm font-medium">
                      {formatCurrency(b.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="text-xs">
                        {cfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            ทั้งหมด {meta.total} รายการ · หน้า {meta.page} จาก {meta.totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1 || isPending}
              onClick={() => goToPage(meta.page - 1)}
            >
              ก่อนหน้า
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages || isPending}
              onClick={() => goToPage(meta.page + 1)}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </div>

      <BookingDetailDialog
        booking={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
